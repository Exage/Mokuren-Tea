import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectConnection } from '@nestjs/mongoose'
import { Types } from 'mongoose'
import type { ClientSession, Connection } from 'mongoose'
import { CategoriesService } from './categories.service.js'
import { ProductsService } from '../products/products.service.js'
import { AuditService } from '../audit/audit.service.js'
import type { CategoryDocument } from './schemas/category.schema.js'
import type { PublicCategoryView } from './categories.types.js'
import { toAdminCategory, toPublicCategory } from './category.mapper.js'

// Conservative upper bound on products moved in a single synchronous transfer.
// A larger transfer would hold the transaction (and the category reference
// locks) for too long on a replica set, so it is rejected instead of split.
export const MAX_TRANSFER_SIZE = 1000

@Injectable()
export class CategoryManagementService {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly productsService: ProductsService,
    private readonly auditService: AuditService,
    @InjectConnection() private readonly connection: Connection
  ) {}

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

  // Public discovery: only categories referenced by at least one published
  // product are visible. Stock availability does not affect visibility.
  async listPublicCategories(): Promise<PublicCategoryView[]> {
    const publishedCategoryIds = await this.productsService.findPublishedCategoryIds()

    const categories: CategoryDocument[] = []

    for (const id of publishedCategoryIds) {
      const category = await this.categoriesService.findById(new Types.ObjectId(id))

      if (category) {
        categories.push(category)
      }
    }

    categories.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder
      }

      return a._id.toHexString().localeCompare(b._id.toHexString())
    })

    return categories.map((category) => toPublicCategory(category))
  }

  // Paginated administrative list. Product counts are grouped for the page's
  // category IDs in a single query and merged in memory; they count every
  // status and are never stored on the category.
  async listAdminCategories(query: {
    page?: number
    limit?: number
    search?: string
  }) {
    const page = query.page ?? 1
    const limit = query.limit ?? 20

    const { docs, totalItems } = await this.categoriesService.listCategories(
      page,
      limit,
      query.search
    )
    const ids = docs.map((doc) => String(doc._id))
    const counts = await this.productsService.countProductsByCategories(ids)

    const items = docs.map((doc) => toAdminCategory(doc, counts.get(String(doc._id)) || 0))

    return {
      items,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    }
  }

  // Product count for a single category, all statuses. Used by the admin
  // controller to populate productsCount on category PATCH responses without
  // importing ProductsModule into CategoriesModule (which would create a
  // circular dependency).
  async countProductsForCategory(categoryId: string): Promise<number> {
    return this.productsService.countProductsByCategory(categoryId)
  }

  // Transactional move-and-delete: reassign every product referencing the
  // source (all statuses) to the target, then remove the source, all inside
  // one transaction with reference locks and audit. A repeated request after
  // successful deletion returns 404 and makes no new changes.
  async moveAndDeleteCategory(
    sourceCategoryId: string,
    dto: { targetCategoryId?: unknown },
    actorId: string | null
  ): Promise<{
    deletedCategoryId: string
    targetCategoryId: string | null
    movedProductsCount: number
  }> {
    const sourceId = toObjectId(sourceCategoryId, 'categoryId')

    let targetId: Types.ObjectId | null = null

    const hasTarget = dto.targetCategoryId !== undefined

    if (hasTarget) {
      if (dto.targetCategoryId === null) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'targetCategoryId must be a string',
        })
      }

      targetId = toObjectId(dto.targetCategoryId as string, 'targetCategoryId')

      if (targetId.equals(sourceId)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Source and target must differ',
        })
      }
    }

    return this.runInTransaction(async (session) => {
      // Acquire reference locks for source and target (deduplicated, sorted)
      // so concurrent bindings and deletions contend on the same documents.
      const idsToLock = [sourceId]
      if (targetId) {
        idsToLock.push(targetId)
      }

      await this.categoriesService.lockReferences(
        idsToLock.map((id) => id.toHexString()),
        session
      )

      // Load the source for the audit snapshot; the target existence was
      // already verified by the reference lock (a missing record fails the
      // increment with a domain error, not an upsert).
      const source = await this.categoriesService.findById(sourceId, session)

      if (!source) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Category not found' })
      }

      const movedProductsCount = await this.productsService.countProductsByCategory(
        sourceId.toHexString(),
        session
      )

      if (movedProductsCount > 0 && !targetId) {
        throw new ConflictException({
          code: 'CATEGORY_TARGET_REQUIRED',
          message: 'Target category is required',
        })
      }

      if (movedProductsCount > MAX_TRANSFER_SIZE) {
        throw new ConflictException({
          code: 'CATEGORY_TRANSFER_TOO_LARGE',
          message: 'Transfer exceeds the synchronous transfer limit',
        })
      }

      if (movedProductsCount > 0 && targetId) {
        const result = await this.productsService.reassignProductsByCategory(
          sourceId.toHexString(),
          targetId.toHexString(),
          session
        )

        if (result.matched !== movedProductsCount || result.modified !== movedProductsCount) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: 'Product reassignment count mismatch',
          })
        }
      }

      const remaining = await this.productsService.countProductsByCategory(
        sourceId.toHexString(),
        session
      )

      if (remaining !== 0) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Source category still references products',
        })
      }

      await this.categoriesService.deleteCategory(sourceId, session)

      const action = targetId ? 'category.moved-and-deleted' : 'category.deleted'

      await this.auditService.record(
        {
          actorId,
          action,
          entityType: 'category',
          entityId: String(sourceId),
          changes: {
            ...(targetId ? { targetCategoryId: targetId.toHexString() } : {}),
            movedProductsCount,
          },
          metadata: {
            sourceId: String(sourceId),
            sourceName: source.name,
            sourceSlug: source.slug,
            targetId: targetId ? String(targetId) : null,
            movedProductsCount,
          },
        },
        session
      )

      return {
        deletedCategoryId: String(sourceId),
        targetCategoryId: targetId ? String(targetId) : null,
        movedProductsCount,
      }
    })
  }
}

function toObjectId(value: string, field: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `${field} must be a valid ObjectId`,
    })
  }

  return new Types.ObjectId(value)
}
