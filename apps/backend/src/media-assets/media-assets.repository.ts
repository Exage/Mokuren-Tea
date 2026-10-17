import { Injectable } from '@nestjs/common'
import { InjectConnection, InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import type { ClientSession, Connection } from 'mongoose'
import { MediaAsset } from './schemas/media-asset.schema.js'
import type { MediaAssetDocument, MediaAssetStatus } from './schemas/media-asset.schema.js'
import type { CloudinaryUploadResult, CloudinaryResourceInfo } from './media-assets.types.js'
import type { MediaAssetsQueryDto } from './dto/media-assets-query.dto.js'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

@Injectable()
export class MediaAssetsRepository {
  constructor(
    @InjectModel(MediaAsset.name) private readonly assetModel: Model<MediaAssetDocument>,
    @InjectConnection() private readonly connection: Connection
  ) {}

  createUploading(asset: Partial<MediaAsset> & { _id: Types.ObjectId }) {
    return this.assetModel.create(asset)
  }

  markUploadFailed(assetId: Types.ObjectId, onlyUploading = false) {
    return this.assetModel
      .updateOne(
        { _id: assetId, ...(onlyUploading ? { status: 'uploading' } : {}) },
        { $set: { status: 'failed' } }
      )
      .exec()
  }

  completeUpload(
    assetId: Types.ObjectId,
    uploaded: CloudinaryUploadResult,
    fallbackFormat: string,
    mimeType: string
  ) {
    return this.assetModel
      .findByIdAndUpdate(
        assetId,
        {
          $set: {
            status: 'ready',
            cloudinaryAssetId: uploaded.assetId || null,
            version: uploaded.version,
            secureUrl: uploaded.secureUrl,
            format: uploaded.format || fallbackFormat,
            mimeType,
            sizeBytes: uploaded.bytes,
            width: uploaded.width,
            height: uploaded.height,
          },
        },
        { returnDocument: 'after' }
      )
      .exec()
  }

  async list(query: MediaAssetsQueryDto, page: number, limit: number) {
    const status = (query.status ?? 'ready') as MediaAssetStatus
    const filter: Record<string, unknown> = { status }

    if (query.search && query.search.trim().length > 0) {
      const pattern = { $regex: escapeRegExp(query.search.trim()), $options: 'i' }
      filter.$or = [{ name: pattern }, { originalName: pattern }]
    }

    const totalItems = await this.assetModel.countDocuments(filter).exec()
    const docs = await this.assetModel
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec()
    return { docs, totalItems }
  }

  findById(id: Types.ObjectId, session?: ClientSession) {
    return this.assetModel
      .findById(id)
      .session(session || null)
      .exec()
  }

  save(asset: MediaAssetDocument) {
    return asset.save()
  }

  async findProductUsages(objectId: Types.ObjectId) {
    const db = this.connection.db

    if (!db) {
      return []
    }

    // Drafts and archived products count as usages as well.
    return db
      .collection('products')
      .find({ imageIds: objectId }, { projection: { name: 1, slug: 1, status: 1 } })
      .limit(200)
      .toArray()
  }

  async countProductReferences(assetId: Types.ObjectId, session?: ClientSession): Promise<number> {
    const db = this.connection.db

    if (!db) {
      return 0
    }

    return db
      .collection('products')
      .countDocuments({ imageIds: assetId }, { session: session || undefined })
  }

  claimDeletion(objectId: Types.ObjectId, session: ClientSession) {
    return this.assetModel
      .updateOne(
        { _id: objectId, status: 'ready', usageCount: 0 },
        { $set: { status: 'deleting' } },
        { session }
      )
      .exec()
  }

  completeDeletion(objectId: Types.ObjectId) {
    return this.assetModel
      .findByIdAndUpdate(
        objectId,
        { $set: { status: 'deleted', deletedAt: new Date() } },
        { returnDocument: 'after' }
      )
      .exec()
  }

  findImages(objectIds: Types.ObjectId[], readyOnly: boolean, session?: ClientSession) {
    return this.assetModel
      .find({
        _id: { $in: objectIds },
        ...(readyOnly ? { status: 'ready', kind: 'image' } : {}),
      })
      .session(session || null)
      .exec()
  }

  incrementUsage(objectIds: Types.ObjectId[], session: ClientSession) {
    return this.assetModel
      .updateMany(
        { _id: { $in: objectIds }, status: 'ready', kind: 'image' },
        { $inc: { usageCount: 1 } },
        { session }
      )
      .exec()
  }

  decrementUsage(objectIds: Types.ObjectId[], session: ClientSession) {
    return this.assetModel
      .updateMany(
        { _id: { $in: objectIds }, usageCount: { $gt: 0 } },
        { $inc: { usageCount: -1 } },
        { session }
      )
      .exec()
  }

  async recalculateUsageCounts(): Promise<{ updated: number }> {
    const db = this.connection.db

    if (!db) {
      return { updated: 0 }
    }

    const counts = new Map<string, number>()
    const cursor = db.collection('products').find({}, { projection: { imageIds: 1 } })

    for await (const product of cursor) {
      const ids = Array.isArray(product.imageIds) ? product.imageIds : []

      for (const id of ids) {
        const key = String(id)
        counts.set(key, (counts.get(key) || 0) + 1)
      }
    }

    await this.assetModel.updateMany({}, { $set: { usageCount: 0 } }).exec()

    let updated = 0

    for (const [id, count] of counts) {
      if (!Types.ObjectId.isValid(id)) {
        continue
      }

      const result = await this.assetModel
        .updateOne({ _id: new Types.ObjectId(id) }, { $set: { usageCount: count } })
        .exec()
      updated += result.modifiedCount
    }

    return { updated }
  }

  findStuckUploads(cutoff: Date, limit: number) {
    return this.assetModel
      .find({ status: 'uploading', createdAt: { $lt: cutoff } })
      .sort({ createdAt: 1 })
      .limit(limit)
      .exec()
  }

  adoptUpload(asset: MediaAssetDocument, resource: CloudinaryResourceInfo) {
    return this.assetModel
      .updateOne(
        { _id: asset._id, status: 'uploading' },
        {
          $set: {
            status: 'ready',
            cloudinaryAssetId: resource.assetId || null,
            // Persist the resolved public ID (includes the Dynamic folder
            // path) so later deletes target the exact asset.
            publicId: resource.publicId || asset.publicId,
            version: resource.version,
            secureUrl: resource.secureUrl,
            format: resource.format || asset.format,
            sizeBytes: resource.bytes || asset.sizeBytes,
            width: resource.width,
            height: resource.height,
          },
        }
      )
      .exec()
  }

  findStuckDeletions(limit: number) {
    return this.assetModel.find({ status: 'deleting' }).sort({ updatedAt: 1 }).limit(limit).exec()
  }

  finishStuckDeletion(assetId: Types.ObjectId) {
    return this.assetModel
      .updateOne(
        { _id: assetId, status: 'deleting' },
        { $set: { status: 'deleted', deletedAt: new Date() } }
      )
      .exec()
  }
}
