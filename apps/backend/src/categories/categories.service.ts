import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectConnection } from '@nestjs/mongoose'
import { Types } from 'mongoose'
import type { ClientSession, Connection } from 'mongoose'
import { CategoriesRepository } from './categories.repository.js'
import { AuditService } from '../audit/audit.service.js'
import {
  normalizeCategoryName,
  normalizeCategorySlug,
  normalizeCategorySortOrder,
} from './category-normalization.js'
import type { CategoryDocument } from './schemas/category.schema.js'
import type { AdminCategoryView } from './categories.types.js'
import { toAdminCategory } from './category.mapper.js'

function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === 11000)
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

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoriesRepository: CategoriesRepository,
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

  async create(
    dto: { name: unknown; slug: unknown; sortOrder?: unknown },
    actorId: string | null
  ): Promise<AdminCategoryView> {
    const name = normalizeCategoryName(dto.name)
    const slug = normalizeCategorySlug(dto.slug)
    const sortOrder = normalizeCategorySortOrder(dto.sortOrder)

    return this.runInTransaction(async (session) => {
      if (!this.categoriesRepository.isReady()) {
        throw new BadRequestException({
          code: 'SERVICE_UNAVAILABLE',
          message: 'Database is not ready',
        })
      }

      const existing = await this.categoriesRepository.findBySlug(slug)

      if (existing) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Category slug is already used',
        })
      }

      let created: CategoryDocument

      try {
        const records = await this.categoriesRepository.create(
          { name, slug, sortOrder, referenceRevision: 0 },
          session
        )

        created = records[0] as CategoryDocument

        if (!created) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: 'Category was not created',
          })
        }
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          throw new ConflictException({
            code: 'CONFLICT',
            message: 'Category slug is already used',
          })
        }

        throw error
      }

      await this.auditService.record(
        {
          actorId,
          action: 'category.created',
          entityType: 'category',
          entityId: String(created._id),
          changes: { name, slug, sortOrder },
        },
        session
      )

      return toAdminCategory(created, 0)
    })
  }

  async update(
    id: string,
    dto: { name?: unknown; slug?: unknown; sortOrder?: unknown },
    actorId: string | null,
    productsCount: number = 0
  ): Promise<AdminCategoryView> {
    const categoryId = toObjectId(id, 'categoryId')

    const hasName = dto.name !== undefined
    const hasSlug = dto.slug !== undefined
    const hasSortOrder = dto.sortOrder !== undefined

    if (!hasName && !hasSlug && !hasSortOrder) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'PATCH body is empty',
      })
    }

    if (hasName && dto.name === null) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'name must be a string',
      })
    }

    if (hasSlug && dto.slug === null) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'slug must be a string',
      })
    }

    if (hasSortOrder && dto.sortOrder === null) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'sortOrder must be a nonnegative safe integer',
      })
    }

    return this.runInTransaction(async (session) => {
      const category = await this.categoriesRepository.findById(categoryId, session)

      if (!category) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Category not found' })
      }

      const changes: Record<string, unknown> = {}
      let slugChanged = false
      let nextSlug: string | undefined

      if (hasName) {
        const name = normalizeCategoryName(dto.name as string)

        if (name !== category.name) {
          category.name = name
          changes.name = name
        }
      }

      if (hasSlug) {
        const slug = normalizeCategorySlug(dto.slug as string)

        if (slug !== category.slug) {
          nextSlug = slug
          slugChanged = true
          changes.slug = slug
        }
      }

      if (hasSortOrder) {
        const sortOrder = normalizeCategorySortOrder(dto.sortOrder as number)

        if (sortOrder !== category.sortOrder) {
          category.sortOrder = sortOrder
          changes.sortOrder = sortOrder
        }
      }

      if (Object.keys(changes).length === 0) {
        // No actual change: return the current view without mutating
        // timestamps or recording a mutation audit event.
        return toAdminCategory(category, productsCount)
      }

      if (slugChanged && nextSlug) {
        const existing = await this.categoriesRepository.findBySlug(nextSlug)

        if (existing && !existing._id.equals(categoryId)) {
          throw new ConflictException({
            code: 'CONFLICT',
            message: 'Category slug is already used',
          })
        }

        category.slug = nextSlug
      }

      try {
        await this.categoriesRepository.save(category as CategoryDocument, session)
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          throw new ConflictException({
            code: 'CONFLICT',
            message: 'Category slug is already used',
          })
        }

        throw error
      }

      await this.auditService.record(
        {
          actorId,
          action: 'category.updated',
          entityType: 'category',
          entityId: String(category._id),
          changes,
        },
        session
      )

      return toAdminCategory(category, productsCount)
    })
  }

  // Service-facing reads used by foreign features (products) as the category
  // boundary. Repositories stay private to this module.
  async findById(id: Types.ObjectId, session?: ClientSession): Promise<CategoryDocument | null> {
    return this.categoriesRepository.findById(id, session)
  }

  async findBySlug(slug: string): Promise<{ _id: Types.ObjectId } | null> {
    return this.categoriesRepository.findBySlug(slug)
  }

  /**
   * lockReferences acquires a transaction-scoped write on each category so
   * concurrent bindings and deletions contend on the same documents. It is a
   * contention mechanism, not a persistent lock: the counter is never
   * decremented and never exposed in API DTOs. A caller-owned ClientSession
   * is required.
   */
  async lockReferences(categoryIds: string[], session: ClientSession): Promise<void> {
    const ids = categoryIds
      .map((id) => toObjectId(id, 'categoryId'))
      .filter((id, index, arr) => arr.findIndex((other) => other.equals(id)) === index)
      .sort((a, b) => a.toHexString().localeCompare(b.toHexString()))

    for (const id of ids) {
      const result = await this.categoriesRepository.incrementReferenceRevision(id, session)

      if (result.matchedCount === 0) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Category not found',
        })
      }
    }
  }

  async listCategories(page: number, limit: number, search?: string) {
    return this.categoriesRepository.listAdmin(page, limit, search)
  }

  async deleteCategory(id: Types.ObjectId, session: ClientSession): Promise<void> {
    const result = await this.categoriesRepository.deleteById(id, session)

    if (result.deletedCount !== 1) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Category not found' })
    }
  }
}
