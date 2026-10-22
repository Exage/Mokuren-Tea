import { toMediaAssetView } from './media-asset.mapper.js'
import { MediaAssetsRepository } from './media-assets.repository.js'
import type {
  UploadedFileInput,
  MediaAssetView,
  ResolvedImage,
  AssetUsageEntry,
  ImagePreset,
} from './media-assets.types.js'
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common'
import { InjectConnection } from '@nestjs/mongoose'
import { Types } from 'mongoose'
import type { ClientSession, Connection } from 'mongoose'
import { AuditService } from '../audit/audit.service.js'
import { CloudinaryService } from './cloudinary.service.js'
import { detectImageFormat } from './utils/detect-image-format.js'
import type { MediaAssetDocument } from './schemas/media-asset.schema.js'

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

const CATALOG_TRANSFORMATION = 'f_auto,q_auto,w_800,c_limit'
const DETAIL_TRANSFORMATION = 'f_auto,q_auto,w_1600,c_limit'

function toObjectId(value: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Media asset id is invalid',
    })
  }

  return new Types.ObjectId(value)
}

@Injectable()
export class MediaAssetsService {
  constructor(
    private readonly mediaAssetsRepository: MediaAssetsRepository,
    private readonly cloudinary: CloudinaryService,
    private readonly auditService: AuditService,
    @InjectConnection() private readonly connection: Connection
  ) {}

  // Fixed Cloudinary optimization presets. Clients cannot pass arbitrary
  // transformation parameters; only these two variants are ever generated.
  buildPresetUrl(secureUrl: string, preset: ImagePreset): string {
    const marker = '/upload/'

    if (!secureUrl.includes(marker)) {
      return secureUrl
    }

    const transformation = preset === 'detail' ? DETAIL_TRANSFORMATION : CATALOG_TRANSFORMATION
    return secureUrl.replace(marker, `/upload/${transformation}/`)
  }

  private toResolvedImage(doc: MediaAssetDocument, preset: ImagePreset): ResolvedImage | null {
    const raw = doc.toObject() as unknown as Record<string, unknown>
    const secureUrl = raw.secureUrl

    if (typeof secureUrl !== 'string' || secureUrl.length === 0) {
      return null
    }

    const image: ResolvedImage = {
      id: String(raw._id),
      url: this.buildPresetUrl(secureUrl, preset),
    }

    if (typeof raw.alt === 'string' && raw.alt.length > 0) {
      image.alt = raw.alt
    }

    if (typeof raw.width === 'number') {
      image.width = raw.width
    }

    if (typeof raw.height === 'number') {
      image.height = raw.height
    }

    return image
  }

  // Upload follows a crash-safe order without holding a MongoDB transaction
  // open across the Cloudinary network call: create uploading, upload with a
  // pre-chosen public_id, then persist confirmed metadata and flip to ready.
  async uploadImageFile(
    file: UploadedFileInput | undefined,
    alt: string | undefined,
    adminId?: string,
    name?: string
  ): Promise<MediaAssetView> {
    if (!file || file.buffer.length === 0) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'File is required' })
    }

    if (file.size > MAX_UPLOAD_BYTES || file.buffer.length > MAX_UPLOAD_BYTES) {
      throw new PayloadTooLargeException({
        code: 'FILE_TOO_LARGE',
        message: `File must not exceed ${MAX_UPLOAD_BYTES} bytes`,
      })
    }

    const detected = detectImageFormat(file.buffer)

    if (!detected) {
      throw new UnsupportedMediaTypeException({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Only JPEG, PNG and WebP images are supported',
      })
    }

    if (!this.cloudinary.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Image storage is not configured',
      })
    }

    const assetId = new Types.ObjectId()
    const publicId = this.cloudinary.buildPublicId(String(assetId))
    const originalName =
      file.originalname.trim().length > 0 ? file.originalname.trim().slice(0, 255) : 'upload'
    const cleanAlt = alt?.trim().slice(0, 500) || ''

    await this.mediaAssetsRepository.createUploading({
      _id: assetId,
      kind: 'image',
      status: 'uploading',
      cloudinaryAssetId: null,
      publicId,
      version: null,
      secureUrl: null,
      originalName,
      name: name?.trim() ?? originalName,
      format: null,
      mimeType: null,
      sizeBytes: file.size,
      width: null,
      height: null,
      alt: cleanAlt,
      usageCount: 0,
      createdBy: adminId || null,
      deletedAt: null,
    })

    let uploaded: Awaited<ReturnType<CloudinaryService['uploadImage']>>

    try {
      uploaded = await this.cloudinary.uploadImage(file.buffer, publicId)
    } catch {
      await this.mediaAssetsRepository.markUploadFailed(assetId)
      await this.auditService.record({
        actorId: adminId || null,
        action: 'media-asset.upload-failed',
        entityType: 'media-asset',
        entityId: String(assetId),
        changes: { publicId },
      })
      throw new ServiceUnavailableException({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Image upload failed, please retry',
      })
    }

    let updated: MediaAssetDocument | null

    try {
      updated = await this.mediaAssetsRepository.completeUpload(
        assetId,
        uploaded,
        detected.format,
        detected.mimeType
      )

      if (!updated) {
        throw new Error('Media asset record disappeared after upload')
      }

      await this.auditService.record({
        actorId: adminId || null,
        action: 'media-asset.uploaded',
        entityType: 'media-asset',
        entityId: String(assetId),
        changes: { publicId, secureUrl: uploaded.secureUrl },
      })
    } catch (error) {
      // Metadata persistence failed after a successful Cloudinary upload.
      // Best-effort cleanup with the pre-known public_id; the reconcile
      // command can finish the job if this cleanup also fails.
      try {
        await this.cloudinary.destroyImage(publicId)
      } catch {
        // Keep the original error; reconcile will retry via publicId.
      }

      await this.mediaAssetsRepository.markUploadFailed(assetId)
      throw error
    }

    // Mapping runs after persistence succeeds, so a response validation error
    // surfaces as a server error without destroying the stored upload.
    if (!updated) {
      throw new Error('Media asset record disappeared after upload')
    }

    return toMediaAssetView(updated)
  }

  async list(query: { page?: number; limit?: number; search?: string; status?: string }): Promise<{
    items: MediaAssetView[]
    pagination: { page: number; limit: number; totalItems: number; totalPages: number }
  }> {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const { docs, totalItems } = await this.mediaAssetsRepository.list(query, page, limit)
    const totalPages = Math.max(1, Math.ceil(totalItems / limit))

    return {
      items: docs.map((doc) => toMediaAssetView(doc)),
      pagination: { page, limit, totalItems, totalPages },
    }
  }

  async getById(id: string): Promise<MediaAssetView> {
    const doc = await this.mediaAssetsRepository.findById(toObjectId(id))

    if (!doc) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Media asset not found' })
    }

    return toMediaAssetView(doc)
  }

  async update(
    id: string,
    input: { name?: string; alt?: string },
    adminId?: string
  ): Promise<MediaAssetView> {
    const objectId = toObjectId(id)
    const doc = await this.mediaAssetsRepository.findById(objectId)

    if (!doc) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Media asset not found' })
    }

    if (doc.status === 'deleting' || doc.status === 'deleted') {
      throw new ConflictException({
        code: 'INVALID_STATUS_TRANSITION',
        message: 'Deleted images cannot be edited',
      })
    }

    const changes: { name?: string; alt?: string } = {}
    if (input.name !== undefined) {
      doc.name = input.name.trim()
      changes.name = doc.name
    }
    if (input.alt !== undefined) {
      doc.alt = input.alt.trim()
      changes.alt = doc.alt
    }
    await this.mediaAssetsRepository.save(doc)
    await this.auditService.record({
      actorId: adminId || null,
      action: 'media-asset.updated',
      entityType: 'media-asset',
      entityId: String(doc._id),
      changes,
    })

    return toMediaAssetView(doc)
  }

  async getUsages(id: string): Promise<AssetUsageEntry[]> {
    const objectId = toObjectId(id)
    const asset = await this.mediaAssetsRepository.findById(objectId)

    if (!asset) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Media asset not found' })
    }

    const products = await this.mediaAssetsRepository.findProductUsages(objectId)

    return products.map((product) => ({
      id: product.id,
      name: typeof product.name === 'string' ? product.name : '',
      slug: typeof product.slug === 'string' ? product.slug : '',
      status: typeof product.status === 'string' ? product.status : '',
    }))
  }

  private async runInTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession()

    try {
      let result: T | undefined

      await session.withTransaction(async () => {
        result = await work(session)
      })

      return result as T
    } finally {
      await session.endSession()
    }
  }

  // Async delete contract: the first call flips ready -> deleting (202) and
  // the Cloudinary removal happens afterwards. Repeat calls never duplicate
  // the transition; a missing Cloudinary resource counts as successful.
  async beginDelete(
    id: string,
    adminId?: string
  ): Promise<{ view: MediaAssetView; started: boolean }> {
    const objectId = toObjectId(id)

    const outcome = await this.runInTransaction(async (session) => {
      const asset = await this.mediaAssetsRepository.findById(objectId, session)

      if (!asset) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Media asset not found' })
      }

      if (asset.status === 'deleted') {
        return { view: toMediaAssetView(asset), started: false, alreadyDeleted: true as const }
      }

      if (asset.status === 'deleting') {
        return { view: toMediaAssetView(asset), started: false, alreadyDeleted: false as const }
      }

      if (asset.status !== 'ready') {
        throw new ConflictException({
          code: 'INVALID_STATUS_TRANSITION',
          message: 'Only ready images can be deleted',
        })
      }

      const references = await this.mediaAssetsRepository.countProductReferences(objectId, session)

      if (references > 0 || asset.usageCount > 0) {
        throw new ConflictException({
          code: 'MEDIA_ASSET_IN_USE',
          message: 'Image is used by products and cannot be deleted',
        })
      }

      // Conditional transition is the concurrency guard: a competing bind
      // that already incremented usageCount makes this update match nothing.
      const claimed = await this.mediaAssetsRepository.claimDeletion(objectId, session)

      if (claimed.modifiedCount !== 1) {
        const retryReferences = await this.mediaAssetsRepository.countProductReferences(
          objectId,
          session
        )

        if (retryReferences > 0) {
          throw new ConflictException({
            code: 'MEDIA_ASSET_IN_USE',
            message: 'Image is used by products and cannot be deleted',
          })
        }

        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Image status changed concurrently, please retry',
        })
      }

      await this.auditService.record(
        {
          actorId: adminId || null,
          action: 'media-asset.delete-started',
          entityType: 'media-asset',
          entityId: String(objectId),
        },
        session
      )

      const refreshed = await this.mediaAssetsRepository.findById(objectId, session)

      if (!refreshed) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Media asset not found' })
      }

      return { view: toMediaAssetView(refreshed), started: true, alreadyDeleted: false as const }
    })

    if (outcome.alreadyDeleted) {
      return { view: outcome.view, started: false }
    }

    if (!outcome.started) {
      // Repeat DELETE on a deleting asset retries the Cloudinary removal
      // below without recording a duplicate delete-started audit entry.
      return this.finishDelete(objectId, adminId, false)
    }

    return this.finishDelete(objectId, adminId, true)
  }

  private async finishDelete(
    objectId: Types.ObjectId,
    adminId: string | undefined,
    auditStart: boolean
  ): Promise<{ view: MediaAssetView; started: boolean }> {
    const asset = await this.mediaAssetsRepository.findById(objectId)

    if (!asset) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Media asset not found' })
    }

    if (asset.status === 'deleted') {
      return { view: toMediaAssetView(asset), started: auditStart }
    }

    try {
      await this.cloudinary.destroyImage(asset.publicId)
    } catch {
      // CDN-backed destroy failed; the asset stays deleting so a repeated
      // DELETE can retry. CDN invalidation itself is not instantaneous even
      // on success.
      const current = await this.mediaAssetsRepository.findById(objectId)

      if (!current) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Media asset not found' })
      }

      throw new ServiceUnavailableException({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Image deletion failed, please retry',
      })
    }

    const deleted = await this.mediaAssetsRepository.completeDeletion(objectId)

    if (!deleted) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Media asset not found' })
    }

    await this.auditService.record({
      actorId: adminId || null,
      action: 'media-asset.deleted',
      entityType: 'media-asset',
      entityId: String(objectId),
      changes: { publicId: deleted.publicId },
    })

    return { view: toMediaAssetView(deleted), started: auditStart }
  }

  // ---- Product integration (all MongoDB-only, never Cloudinary reads) ----

  // Throws 404 for missing ids and 409 for non-ready assets.
  async assertImagesReady(imageIds: string[], session?: ClientSession): Promise<void> {
    if (imageIds.length === 0) {
      return
    }

    const objectIds = imageIds.map((id) => toObjectId(id))
    const docs = await this.mediaAssetsRepository.findImages(objectIds, false, session)

    if (docs.length !== objectIds.length) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'One or more images do not exist',
      })
    }

    const notReady = docs.filter((doc) => doc.status !== 'ready' || doc.kind !== 'image')

    if (notReady.length > 0) {
      throw new ConflictException({
        code: 'MEDIA_ASSET_NOT_READY',
        message: 'Only ready images can be linked to products',
        details: notReady.map((doc) => ({ assetId: String(doc._id), status: doc.status })),
      })
    }
  }

  async countReadyImages(imageIds: string[], session?: ClientSession): Promise<number> {
    if (imageIds.length === 0) {
      return 0
    }

    const objectIds = imageIds.map((id) => toObjectId(id))
    const docs = await this.mediaAssetsRepository.findImages(objectIds, true, session)
    return docs.length
  }

  // Conditionally increments only ready assets so a concurrent delete that
  // flipped the status aborts the bind instead of resurrecting the image.
  async incrementUsageFor(imageIds: string[], session: ClientSession): Promise<void> {
    if (imageIds.length === 0) {
      return
    }

    const objectIds = imageIds.map((id) => toObjectId(id))
    const result = await this.mediaAssetsRepository.incrementUsage(objectIds, session)

    if (result.modifiedCount !== objectIds.length) {
      throw new ConflictException({
        code: 'MEDIA_ASSET_NOT_READY',
        message: 'Only ready images can be linked to products',
      })
    }
  }

  async decrementUsageFor(imageIds: string[], session: ClientSession): Promise<void> {
    if (imageIds.length === 0) {
      return
    }

    const objectIds = imageIds.map((id) => toObjectId(id))
    await this.mediaAssetsRepository.decrementUsage(objectIds, session)
  }

  // Batch loader for product responses: one MongoDB query, product order
  // preserved, only ready images with confirmed URLs included.
  async resolveAdminImages(imageIds: string[]): Promise<ResolvedImage[]> {
    return this.resolveImages(imageIds, 'catalog', false)
  }

  async resolvePublicImages(imageIds: string[], preset: ImagePreset): Promise<ResolvedImage[]> {
    return this.resolveImages(imageIds, preset, true)
  }

  private async resolveImages(
    imageIds: string[],
    preset: ImagePreset,
    optimized: boolean
  ): Promise<ResolvedImage[]> {
    if (imageIds.length === 0) {
      return []
    }

    const objectIds = imageIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id))

    if (objectIds.length === 0) {
      return []
    }

    const docs = await this.mediaAssetsRepository.findImages(objectIds, true)
    const byId = new Map<string, MediaAssetDocument>()

    for (const doc of docs) {
      byId.set(String(doc._id), doc)
    }

    const result: ResolvedImage[] = []

    for (const id of imageIds) {
      const doc = byId.get(id)

      if (!doc) {
        continue
      }

      const resolved = optimized ? this.toResolvedImage(doc, preset) : this.toAdminImage(doc)

      if (resolved) {
        result.push(resolved)
      }
    }

    return result
  }

  private toAdminImage(doc: MediaAssetDocument): ResolvedImage | null {
    const raw = doc.toObject() as unknown as Record<string, unknown>
    const secureUrl = raw.secureUrl

    if (typeof secureUrl !== 'string' || secureUrl.length === 0) {
      return null
    }

    const image: ResolvedImage = { id: String(raw._id), url: secureUrl }

    if (typeof raw.alt === 'string' && raw.alt.length > 0) {
      image.alt = raw.alt
    }

    if (typeof raw.width === 'number') {
      image.width = raw.width
    }

    if (typeof raw.height === 'number') {
      image.height = raw.height
    }

    return image
  }

  // Recalculates usageCount from actual Product.imageIds. Required once for
  // pre-existing data so legacy assets are not treated as unused.
  async recalculateUsageCounts(): Promise<{ updated: number }> {
    return this.mediaAssetsRepository.recalculateUsageCounts()
  }

  // Repeatable recovery for stuck uploads and unfinished deletions.
  async reconcileStuck(options?: { staleMs?: number; limit?: number }): Promise<{
    adoptedUploads: number
    failedUploads: number
    finishedDeletions: number
  }> {
    const staleMs = options?.staleMs ?? 30 * 60 * 1000
    const limit = options?.limit ?? 100
    const cutoff = new Date(Date.now() - staleMs)

    const stuckUploads = await this.mediaAssetsRepository.findStuckUploads(cutoff, limit)

    let adoptedUploads = 0
    let failedUploads = 0

    for (const asset of stuckUploads) {
      // A fetch failure means Cloudinary is unreachable right now; skip the
      // asset so a later run can retry instead of marking it failed.
      const resource = await this.cloudinary.fetchResource(asset.publicId).catch(() => undefined)

      if (resource === undefined) {
        continue
      }

      if (resource) {
        await this.mediaAssetsRepository.adoptUpload(asset, resource)
        await this.auditService.record({
          actorId: null,
          action: 'media-asset.reconciled',
          entityType: 'media-asset',
          entityId: String(asset._id),
          changes: { from: 'uploading', to: 'ready' },
        })
        adoptedUploads += 1
      } else {
        await this.mediaAssetsRepository.markUploadFailed(asset._id, true)
        await this.auditService.record({
          actorId: null,
          action: 'media-asset.reconciled',
          entityType: 'media-asset',
          entityId: String(asset._id),
          changes: { from: 'uploading', to: 'failed' },
        })
        failedUploads += 1
      }
    }

    const stuckDeletions = await this.mediaAssetsRepository.findStuckDeletions(limit)

    let finishedDeletions = 0

    for (const asset of stuckDeletions) {
      try {
        await this.cloudinary.destroyImage(asset.publicId)
      } catch {
        continue
      }

      const result = await this.mediaAssetsRepository.finishStuckDeletion(asset._id)

      if (result.modifiedCount === 1) {
        await this.auditService.record({
          actorId: null,
          action: 'media-asset.reconciled',
          entityType: 'media-asset',
          entityId: String(asset._id),
          changes: { from: 'deleting', to: 'deleted' },
        })
        finishedDeletions += 1
      }
    }

    return { adoptedUploads, failedUploads, finishedDeletions }
  }
}
