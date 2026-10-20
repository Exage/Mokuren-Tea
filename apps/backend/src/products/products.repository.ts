import { Injectable } from '@nestjs/common'
import { InjectConnection, InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import type { ClientSession, Connection, PipelineStage, Types } from 'mongoose'
import { Product } from './schemas/product.schema.js'
import type { ProductDocument } from './schemas/product.schema.js'
import type { AdminProductsQueryDto } from './dto/admin-products-query.dto.js'
import type { CatalogCriteria } from './products.types.js'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

@Injectable()
export class ProductsRepository {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectConnection() private readonly connection: Connection
  ) {}

  isReady(): boolean {
    return Boolean(this.connection.db)
  }

  findById(id: string, session?: ClientSession) {
    return this.productModel
      .findById(id)
      .session(session || null)
      .exec()
  }

  create(products: Product[], session: ClientSession) {
    return this.productModel.create(products, { session })
  }

  save(product: ProductDocument, session: ClientSession) {
    return product.save({ session })
  }

  countProductsByCategory(categoryId: Types.ObjectId, session?: ClientSession) {
    return this.productModel.countDocuments({ categoryId }).session(session || null).exec()
  }

  findPublishedCategoryIds() {
    return this.productModel.distinct('categoryId', {
      status: 'published',
      categoryId: { $exists: true, $ne: null },
    })
  }

  reassignProductsByCategory(
    sourceCategoryId: Types.ObjectId,
    targetCategoryId: Types.ObjectId,
    session: ClientSession
  ) {
    return this.productModel.updateMany(
      { categoryId: sourceCategoryId },
      { $set: { categoryId: targetCategoryId } },
      { session }
    )
  }

  async countProductsByCategories(
    ids: Types.ObjectId[],
    session?: ClientSession
  ): Promise<Map<string, number>> {
    if (ids.length === 0) {
      return new Map()
    }

    const rows = await this.productModel
      .aggregate([
        { $match: { categoryId: { $in: ids } } },
        { $group: { _id: '$categoryId', count: { $sum: 1 } } },
      ])
      .session(session || null)
      .exec()

    const counts = new Map<string, number>()

    for (const row of rows) {
      counts.set(String(row._id), row.count)
    }

    return counts
  }

  findPublishedTasteNoteIds() {
    return this.productModel.distinct('tasteNoteIds', {
      status: 'published',
      'tasteNoteIds.0': { $exists: true },
    })
  }

  countProductsByTasteNote(tasteNoteId: Types.ObjectId, session?: ClientSession) {
    return this.productModel
      .countDocuments({ tasteNoteIds: tasteNoteId })
      .session(session || null)
      .exec()
  }

  async countProductsByTasteNotes(
    ids: Types.ObjectId[],
    session?: ClientSession
  ): Promise<Map<string, number>> {
    if (ids.length === 0) {
      return new Map()
    }

    const rows = await this.productModel
      .aggregate([
        { $match: { tasteNoteIds: { $in: ids } } },
        { $unwind: '$tasteNoteIds' },
        { $match: { tasteNoteIds: { $in: ids } } },
        { $group: { _id: '$tasteNoteIds', count: { $sum: 1 } } },
      ])
      .session(session || null)
      .exec()

    const counts = new Map<string, number>()

    for (const row of rows) {
      counts.set(String(row._id), row.count)
    }

    return counts
  }

  unbindTasteNoteFromAllProducts(tasteNoteId: Types.ObjectId, session: ClientSession) {
    return this.productModel.updateMany(
      { tasteNoteIds: tasteNoteId },
      { $pull: { tasteNoteIds: tasteNoteId } },
      { session }
    )
  }

  findPublishedBySlug(slug: string) {
    return this.productModel.findOne({ slug, status: 'published' }).lean().exec()
  }

  async listAdmin(query: AdminProductsQueryDto, page: number, limit: number) {
    const filter: Record<string, unknown> = {}

    if (query.status) {
      filter.status = query.status
    }

    if (query.search && query.search.trim().length > 0) {
      const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { slug: { $regex: escaped, $options: 'i' } },
      ]
    }

    const totalItems = await this.productModel.countDocuments(filter).exec()
    const docs = await this.productModel
      .find(filter)
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec()

    return { docs, totalItems }
  }

  async listCatalog(criteria: CatalogCriteria) {
    const { page, limit } = criteria
    const match: Record<string, unknown> = { status: 'published' }

    if (criteria.categoryId) {
      match.categoryId = criteria.categoryId
    }

    if (criteria.tasteNoteIds) {
      match.tasteNoteIds = { $all: criteria.tasteNoteIds }
    }

    if (criteria.search) {
      const pattern = escapeRegExp(criteria.search)
      match.$or = [
        { name: { $regex: pattern, $options: 'i' } },
        { slug: { $regex: pattern, $options: 'i' } },
      ]
    }

    const sort = criteria.sort
    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $addFields: {
          __minPrice: {
            $min: {
              $map: {
                input: {
                  $filter: {
                    input: '$variants',
                    as: 'variant',
                    cond: { $eq: ['$$variant.enabled', true] },
                  },
                },
                as: 'enabledVariant',
                in: '$$enabledVariant.price',
              },
            },
          },
        },
      },
    ]

    // Price filtering uses the minimum among enabled variants, regardless of stock.
    if (criteria.minPrice !== undefined) {
      pipeline.push({ $match: { __minPrice: { $gte: criteria.minPrice } } })
    }

    if (criteria.maxPrice !== undefined) {
      pipeline.push({ $match: { __minPrice: { $lte: criteria.maxPrice } } })
    }

    if (sort === 'price-asc') {
      pipeline.push({ $sort: { __minPrice: 1, _id: -1 } })
    } else if (sort === 'price-desc') {
      pipeline.push({ $sort: { __minPrice: -1, _id: -1 } })
    } else {
      pipeline.push({ $sort: { firstPublishedAt: -1, _id: -1 } })
    }

    // Out-of-stock products keep their sort position and are never demoted.
    pipeline.push({
      $facet: {
        items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        total: [{ $count: 'count' }],
      },
    })

    const aggregated = await this.productModel.aggregate(pipeline).exec()
    const first = aggregated[0] as
      { items?: Record<string, unknown>[]; total?: { count: number }[] } | undefined
    const rawItems = first?.items || []
    const totalItems = first?.total?.[0]?.count || 0
    return { rawItems, totalItems }
  }
}
