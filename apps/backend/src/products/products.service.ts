import { ProductsRepository } from './products.repository.js'
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectConnection } from '@nestjs/mongoose'
import { randomUUID } from 'node:crypto'
import { Types } from 'mongoose'
import type { ClientSession, Connection } from 'mongoose'
import { AuditService } from '../audit/audit.service.js'
import { CategoriesService } from '../categories/categories.service.js'
import { InventoryService } from '../inventory/inventory.service.js'
import { MediaAssetsService } from '../media-assets/media-assets.service.js'
import { AdminProductsQueryDto } from './dto/admin-products-query.dto.js'
import { CreateProductDto } from './dto/create-product.dto.js'
import { CreateProductVariantDto } from './dto/create-product-variant.dto.js'
import { UpdateProductDto } from './dto/update-product.dto.js'
import { UpdateProductVariantDto } from './dto/update-product-variant.dto.js'
import {
  isValidProductPrice,
  ProductPrice,
  productPriceToNumber,
  toProductPrice,
} from './domain/product-price.js'
import { checkProductPublication } from './domain/product-publication.js'
import type { ProductDocument } from './schemas/product.schema.js'
import type { AdminProductView, LoadedImage, LoadedProduct } from './products.types.js'
import { toAdminProduct, toLoadedProduct } from './product.mapper.js'

interface StoredVariant {
  variantId: string
  weightGrams: number
  price: ProductPrice
  enabled: boolean
}

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  return (error as { code?: unknown }).code === 11000
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

function assertNoDuplicateImageIds(imageIds: string[]): void {
  const seen = new Set<string>()

  for (const id of imageIds) {
    if (seen.has(id)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Duplicate imageIds are not allowed',
      })
    }

    seen.add(id)
  }
}

function toImageIdStrings(imageIds: unknown[]): string[] {
  return imageIds.map((id) => String(id))
}

// Shared between draft creation and the dedicated add-variant endpoint so
// both paths apply identical rules. `enabled` defaults to true when omitted.
function toStoredVariant(input: {
  weightGrams: number
  price: number
  enabled?: boolean
}): StoredVariant {
  return {
    variantId: `v_${randomUUID()}`,
    weightGrams: input.weightGrams,
    price: toProductPrice(input.price),
    enabled: input.enabled ?? true,
  }
}

function assertUniqueVariantWeights(variants: StoredVariant[]): void {
  const seen = new Set<number>()

  for (const variant of variants) {
    if (seen.has(variant.weightGrams)) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `Duplicate variant weight ${variant.weightGrams}g within one product`,
      })
    }

    seen.add(variant.weightGrams)
  }
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly categoriesService: CategoriesService,
    private readonly inventoryService: InventoryService,
    private readonly mediaAssetsService: MediaAssetsService,
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

  private toProductView(
    doc: ProductDocument | LoadedProduct,
    images: LoadedImage[],
    stock: { physicalGrams: number; reservedGrams: number }
  ): AdminProductView {
    return toAdminProduct(toLoadedProduct(doc), images, stock)
  }

  private async loadAdminImages(imageIds: string[]): Promise<LoadedImage[]> {
    if (imageIds.length === 0) {
      return []
    }

    const resolved = await this.mediaAssetsService.resolveAdminImages(imageIds)
    return resolved.map((image) => ({
      id: image.id,
      url: image.url,
      ...(image.alt ? { alt: image.alt } : {}),
      ...(typeof image.width === 'number' ? { width: image.width } : {}),
      ...(typeof image.height === 'number' ? { height: image.height } : {}),
    }))
  }

  // Real existence checks against reference collections. Format validation
  // alone never counts as proof that the referenced record exists. Image
  // links are verified through MediaAssetsService so only ready assets pass.
  private async assertReferencesExist(
    input: { categoryId?: string | null; tasteNoteIds?: string[]; imageIds?: string[] },
    session: ClientSession
  ): Promise<void> {
    if (!this.productsRepository.isReady()) {
      throw new BadRequestException({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database is not ready',
      })
    }

    if (input.categoryId !== undefined && input.categoryId !== null) {
      const categoryId = toObjectId(input.categoryId, 'categoryId')
      const found = await this.categoriesService.findById(categoryId, session)

      if (!found) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Category does not exist' })
      }
    }

    if (input.tasteNoteIds && input.tasteNoteIds.length > 0) {
      const ids = input.tasteNoteIds.map((id) => toObjectId(id, 'tasteNoteIds'))
      const count = await this.productsRepository.countTasteNotes(ids, session)

      if (count !== ids.length) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'One or more taste notes do not exist',
        })
      }
    }

    if (input.imageIds && input.imageIds.length > 0) {
      assertNoDuplicateImageIds(input.imageIds)
      await this.mediaAssetsService.assertImagesReady(input.imageIds, session)
    }
  }

  private async loadOrFail(id: string, session?: ClientSession): Promise<ProductDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Product id is invalid' })
    }

    const product = await this.productsRepository.findById(id, session)

    if (!product) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found' })
    }

    return product
  }

  async createDraft(dto: CreateProductDto, actorId?: string): Promise<AdminProductView> {
    const name = dto.name.trim()
    const slug = dto.slug.trim().toLowerCase()

    if (name.length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Product name is required',
      })
    }

    if (dto.imageIds) {
      assertNoDuplicateImageIds(dto.imageIds)
    }

    const createdId = await this.runInTransaction(async (session) => {
      await this.assertReferencesExist(
        { categoryId: dto.categoryId, tasteNoteIds: dto.tasteNoteIds, imageIds: dto.imageIds },
        session
      )

      // Protect the category binding so a concurrent deletion cannot remove
      // the category while this product references it.
      if (dto.categoryId) {
        await this.categoriesService.lockReferences([dto.categoryId], session)
      }

      const variants = (dto.variants || []).map((variant) => toStoredVariant(variant))
      assertUniqueVariantWeights(variants)

      let created: ProductDocument

      try {
        const records = await this.productsRepository.create(
          [
            {
              name,
              slug,
              description: dto.description || '',
              categoryId: dto.categoryId ? new Types.ObjectId(dto.categoryId) : null,
              tasteNoteIds: (dto.tasteNoteIds || []).map((id) => new Types.ObjectId(id)),
              imageIds: (dto.imageIds || []).map((id) => new Types.ObjectId(id)),
              variants,
              status: 'draft',
              firstPublishedAt: null,
              lastPublishedAt: null,
              lowStockThresholdGrams: dto.lowStockThresholdGrams || 0,
            },
          ],
          session
        )
        const first = records[0]

        if (!first) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: 'Product was not created',
          })
        }

        created = first
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          throw new ConflictException({ code: 'CONFLICT', message: 'Product slug is already used' })
        }

        throw error
      }

      // Binding and the usageCount increments commit atomically with the
      // product itself; the conditional increment rejects concurrently
      // deleted assets.
      await this.mediaAssetsService.incrementUsageFor(dto.imageIds || [], session)
      await this.inventoryService.createZeroStock(created._id as Types.ObjectId, session)
      await this.auditService.record(
        {
          actorId: actorId || null,
          action: 'product.created',
          entityType: 'product',
          entityId: String(created._id),
          changes: { name, slug },
        },
        session
      )

      return String(created._id)
    })

    const created = await this.loadOrFail(createdId)
    const stock = await this.inventoryService.getStockFor(created._id as Types.ObjectId)
    const images = await this.loadAdminImages(
      toImageIdStrings((created.imageIds as unknown[]) || [])
    )
    return this.toProductView(created, images, stock)
  }

  async getAdminCard(id: string): Promise<AdminProductView> {
    const product = await this.loadOrFail(id)
    const stock = await this.inventoryService.getStockFor(product._id as Types.ObjectId)
    const images = await this.loadAdminImages(
      toImageIdStrings((product.imageIds as unknown[]) || [])
    )
    return this.toProductView(product, images, stock)
  }

  async listAdmin(query: AdminProductsQueryDto): Promise<{
    items: AdminProductView[]
    pagination: { page: number; limit: number; totalItems: number; totalPages: number }
  }> {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const { docs, totalItems } = await this.productsRepository.listAdmin(query, page, limit)
    const totalPages = Math.max(1, Math.ceil(totalItems / limit))

    const ids = docs.map((doc) => doc._id as Types.ObjectId)
    const stocks = await this.inventoryService.getStockForMany(ids)

    const allImageIds: string[] = []

    for (const doc of docs) {
      for (const imageId of (doc.imageIds as unknown[]) || []) {
        const key = String(imageId)

        if (!allImageIds.includes(key)) {
          allImageIds.push(key)
        }
      }
    }

    const resolved = await this.loadAdminImages(allImageIds)
    const byId = new Map(resolved.map((image) => [image.id, image]))

    const items = docs.map((doc) => {
      const stock = stocks.get(String(doc._id)) || { physicalGrams: 0, reservedGrams: 0 }
      const ordered: LoadedImage[] = []

      for (const imageId of (doc.imageIds as unknown[]) || []) {
        const image = byId.get(String(imageId))

        if (image) {
          ordered.push(image)
        }
      }

      return this.toProductView(doc, ordered, stock)
    })

    return { items, pagination: { page, limit, totalItems, totalPages } }
  }

  async updateCard(id: string, dto: UpdateProductDto, actorId?: string): Promise<AdminProductView> {
    if (dto.imageIds) {
      assertNoDuplicateImageIds(dto.imageIds)
    }

    const updatedId = await this.runInTransaction(async (session) => {
      const product = await this.loadOrFail(id, session)
      await this.assertReferencesExist(
        { categoryId: dto.categoryId, tasteNoteIds: dto.tasteNoteIds, imageIds: dto.imageIds },
        session
      )

      const changes: Record<string, unknown> = {}

      if (dto.name !== undefined) {
        const name = dto.name.trim()

        if (name.length === 0) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: 'Product name is required',
          })
        }

        product.name = name
        changes.name = name
      }

      if (dto.description !== undefined) {
        product.description = dto.description
        changes.description = dto.description
      }

      if (dto.categoryId !== undefined) {
        // An incomplete draft may be kept without a category, but a
        // published product must always remain bound to one.
        if (product.status === 'published' && dto.categoryId === null) {
          throw new ConflictException({
            code: 'INVALID_STATUS_TRANSITION',
            message: 'Published products cannot be cleared of their category',
          })
        }

        if (dto.categoryId !== null) {
          const next = new Types.ObjectId(dto.categoryId)

          if (!product.categoryId || !product.categoryId.equals(next)) {
            await this.categoriesService.lockReferences([dto.categoryId], session)
          }
        }

        product.categoryId = dto.categoryId ? new Types.ObjectId(dto.categoryId) : null
        changes.categoryId = dto.categoryId
      }

      if (dto.tasteNoteIds !== undefined) {
        product.tasteNoteIds = dto.tasteNoteIds.map(
          (entry) => new Types.ObjectId(entry)
        ) as Types.Array<Types.ObjectId>
        changes.tasteNoteIds = dto.tasteNoteIds
      }

      if (dto.imageIds !== undefined) {
        // A published card always keeps at least one photo; drafts may be
        // imageless while being assembled.
        if (product.status === 'published' && dto.imageIds.length === 0) {
          throw new ConflictException({
            code: 'INVALID_STATUS_TRANSITION',
            message: 'Published products must keep at least one image',
          })
        }

        const previous = toImageIdStrings((product.imageIds as unknown[]) || [])
        const next = [...dto.imageIds]
        const previousSet = new Set(previous)
        const nextSet = new Set(next)
        const added = next.filter((entry) => !previousSet.has(entry))
        const removed = previous.filter((entry) => !nextSet.has(entry))

        // Reordering alone leaves counters untouched.
        await this.mediaAssetsService.incrementUsageFor(added, session)
        await this.mediaAssetsService.decrementUsageFor(removed, session)

        product.imageIds = dto.imageIds.map(
          (entry) => new Types.ObjectId(entry)
        ) as Types.Array<Types.ObjectId>
        changes.imageIds = dto.imageIds
      }

      if (dto.lowStockThresholdGrams !== undefined) {
        product.lowStockThresholdGrams = dto.lowStockThresholdGrams
        changes.lowStockThresholdGrams = dto.lowStockThresholdGrams
      }

      await this.productsRepository.save(product, session)
      await this.auditService.record(
        {
          actorId: actorId || null,
          action: 'product.updated',
          entityType: 'product',
          entityId: String(product._id),
          changes,
        },
        session
      )

      return String(product._id)
    })

    const updated = await this.loadOrFail(updatedId)
    const stock = await this.inventoryService.getStockFor(updated._id as Types.ObjectId)
    const images = await this.loadAdminImages(
      toImageIdStrings((updated.imageIds as unknown[]) || [])
    )
    return this.toProductView(updated, images, stock)
  }

  async addVariant(
    id: string,
    dto: CreateProductVariantDto,
    actorId?: string
  ): Promise<AdminProductView> {
    const updatedId = await this.runInTransaction(async (session) => {
      const product = await this.loadOrFail(id, session)
      const current = (product.variants as unknown as StoredVariant[]).map((variant) => ({
        variantId: variant.variantId,
        weightGrams: variant.weightGrams,
        price: variant.price,
        enabled: variant.enabled,
      }))
      const created = toStoredVariant(dto)
      assertUniqueVariantWeights([...current, created])

      product.variants = [...current, created] as unknown as Types.Array<StoredVariant>
      await this.productsRepository.save(product, session)
      await this.auditService.record(
        {
          actorId: actorId || null,
          action: 'product.variant-added',
          entityType: 'product',
          entityId: String(product._id),
          changes: {
            variantId: created.variantId,
            weightGrams: created.weightGrams,
            price: productPriceToNumber(created.price),
          },
        },
        session
      )

      return String(product._id)
    })

    const updated = await this.loadOrFail(updatedId)
    const stock = await this.inventoryService.getStockFor(updated._id as Types.ObjectId)
    const images = await this.loadAdminImages(
      toImageIdStrings((updated.imageIds as unknown[]) || [])
    )
    return this.toProductView(updated, images, stock)
  }

  async updateVariant(
    id: string,
    variantId: string,
    dto: UpdateProductVariantDto,
    actorId?: string
  ): Promise<AdminProductView> {
    const updatedId = await this.runInTransaction(async (session) => {
      const product = await this.loadOrFail(id, session)
      const current = (product.variants as unknown as StoredVariant[]).map((variant) => ({
        variantId: variant.variantId,
        weightGrams: variant.weightGrams,
        price: variant.price,
        enabled: variant.enabled,
      }))
      const index = current.findIndex((variant) => variant.variantId === variantId)

      if (index === -1) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Variant not found' })
      }

      const existing = current[index]

      if (!existing) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Variant not found' })
      }

      const next: StoredVariant = {
        variantId: existing.variantId,
        weightGrams: dto.weightGrams ?? existing.weightGrams,
        price: dto.price === undefined ? existing.price : toProductPrice(dto.price),
        enabled: dto.enabled ?? existing.enabled,
      }

      if (!Number.isInteger(next.weightGrams) || next.weightGrams <= 0) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'weightGrams must be a positive integer',
        })
      }

      if (!isValidProductPrice(next.price)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'price must be valid BYN amount',
        })
      }

      const updated = current.map((variant, position) => (position === index ? next : variant))
      assertUniqueVariantWeights(updated)

      product.variants = updated as unknown as Types.Array<StoredVariant>
      await this.productsRepository.save(product, session)
      await this.auditService.record(
        {
          actorId: actorId || null,
          action: 'product.variant-updated',
          entityType: 'product',
          entityId: String(product._id),
          changes: {
            variantId,
            weightGrams: next.weightGrams,
            price: productPriceToNumber(next.price),
            enabled: next.enabled,
          },
        },
        session
      )

      return String(product._id)
    })

    const updated = await this.loadOrFail(updatedId)
    const stock = await this.inventoryService.getStockFor(updated._id as Types.ObjectId)
    const images = await this.loadAdminImages(
      toImageIdStrings((updated.imageIds as unknown[]) || [])
    )
    return this.toProductView(updated, images, stock)
  }

  async publish(id: string, actorId?: string): Promise<AdminProductView> {
    const publishedId = await this.runInTransaction(async (session) => {
      const product = await this.loadOrFail(id, session)

      if (product.status === 'archived') {
        throw new ConflictException({
          code: 'INVALID_STATUS_TRANSITION',
          message: 'Archived products cannot be published again',
        })
      }

      if (product.status === 'published') {
        return String(product._id)
      }

      let categoryExists = false

      if (product.categoryId) {
        const found = await this.categoriesService.findById(product.categoryId, session)
        categoryExists = Boolean(found)

        // Lock the category binding so a concurrent transfer or deletion
        // cannot remove it while this product is published against it.
        await this.categoriesService.lockReferences([product.categoryId.toHexString()], session)
      }

      const imageIds = toImageIdStrings((product.imageIds as unknown[]) || [])
      const readyCount = await this.mediaAssetsService.countReadyImages(imageIds, session)
      const imagesExist = readyCount === imageIds.length && imageIds.length > 0

      const check = checkProductPublication({
        name: product.name,
        categoryExists,
        imageCount: imagesExist ? imageIds.length : 0,
        variants: ((product.variants as unknown as StoredVariant[]) || []).map((variant) => ({
          weightGrams: variant.weightGrams,
          price: variant.price,
          enabled: variant.enabled,
        })),
      })

      if (!check.ready) {
        throw new ConflictException({
          code: 'INVALID_STATUS_TRANSITION',
          message: 'Product is not ready for publication',
          details: check.violations,
        })
      }

      const now = new Date()
      product.status = 'published'

      if (!product.firstPublishedAt) {
        product.firstPublishedAt = now
      }

      product.lastPublishedAt = now
      await this.productsRepository.save(product, session)
      await this.auditService.record(
        {
          actorId: actorId || null,
          action: 'product.published',
          entityType: 'product',
          entityId: String(product._id),
        },
        session
      )

      return String(product._id)
    })

    const published = await this.loadOrFail(publishedId)
    const stock = await this.inventoryService.getStockFor(published._id as Types.ObjectId)
    const images = await this.loadAdminImages(
      toImageIdStrings((published.imageIds as unknown[]) || [])
    )
    return this.toProductView(published, images, stock)
  }

  async archive(id: string, actorId?: string): Promise<AdminProductView> {
    const archivedId = await this.runInTransaction(async (session) => {
      const product = await this.loadOrFail(id, session)

      if (product.status === 'archived') {
        return String(product._id)
      }

      product.status = 'archived'
      await this.productsRepository.save(product, session)
      await this.auditService.record(
        {
          actorId: actorId || null,
          action: 'product.archived',
          entityType: 'product',
          entityId: String(product._id),
        },
        session
      )

      return String(product._id)
    })

    // Archiving keeps image links and usageCount untouched.
    const archived = await this.loadOrFail(archivedId)
    const stock = await this.inventoryService.getStockFor(archived._id as Types.ObjectId)
    const images = await this.loadAdminImages(
      toImageIdStrings((archived.imageIds as unknown[]) || [])
    )
    return this.toProductView(archived, images, stock)
  }

  async countProductsByCategory(categoryId: string, session?: ClientSession): Promise<number> {
    const id = toObjectId(categoryId, 'categoryId')
    return this.productsRepository.countProductsByCategory(id, session)
  }

  async findPublishedCategoryIds(): Promise<string[]> {
    const ids = await this.productsRepository.findPublishedCategoryIds()
    return ids.map((id) => String(id))
  }

  async reassignProductsByCategory(
    sourceCategoryId: string,
    targetCategoryId: string,
    session: ClientSession
  ): Promise<{ matched: number; modified: number }> {
    const source = toObjectId(sourceCategoryId, 'categoryId')
    const target = toObjectId(targetCategoryId, 'categoryId')

    if (source.equals(target)) {
      return { matched: 0, modified: 0 }
    }

    const result = await this.productsRepository.reassignProductsByCategory(
      source,
      target,
      session
    )

    return {
      matched: result.matchedCount,
      modified: result.modifiedCount,
    }
  }

  async countProductsByCategories(categoryIds: string[], session?: ClientSession): Promise<Map<string, number>> {
    const ids = categoryIds.map((id) => toObjectId(id, 'categoryId'))
    return this.productsRepository.countProductsByCategories(ids, session)
  }
}
