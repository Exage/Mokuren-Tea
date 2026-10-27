import { getAvailableGrams, isOutOfStock } from './domain/product-availability.js'
import { ProductsRepository } from './products.repository.js'
import type { CatalogCriteria, ProductStockOverview } from './products.types.js'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Types } from 'mongoose'
import { InventoryService } from '../inventory/inventory.service.js'
import { MediaAssetsService } from '../media-assets/media-assets.service.js'
import { CategoriesService } from '../categories/categories.service.js'
import { ProductCatalogQueryDto } from './dto/product-catalog-query.dto.js'
import { toProductPrice } from './domain/product-price.js'
import type { LoadedImage, LoadedStock, PublicProductView } from './products.types.js'
import { toPublicProduct, toLoadedProduct } from './product.mapper.js'

const DEFAULT_PAGE_LIMIT = 16

interface CatalogPage {
  items: PublicProductView[]
  pagination: { page: number; limit: number; totalItems: number; totalPages: number }
}

@Injectable()
export class ProductCatalogService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly categoriesService: CategoriesService,
    private readonly inventoryService: InventoryService,
    private readonly mediaAssetsService: MediaAssetsService
  ) {}

  async getStockOverview(): Promise<ProductStockOverview> {
    const products = await this.productsRepository.findPublishedForStockOverview()
    const productIds = products.map((p) => new Types.ObjectId(String(p._id)))
    const stocks = await this.inventoryService.getStockForMany(productIds)

    let lowStockProducts = 0
    let outOfStockProducts = 0
    const problematic: ProductStockOverview['problematicProducts'] = []

    for (const product of products) {
      const stock = stocks.get(String(product._id)) || {
        physicalGrams: 0,
        reservedGrams: 0,
      }
      const availableGrams = getAvailableGrams(stock.physicalGrams, stock.reservedGrams)

      const variants = Array.isArray(product.variants) ? product.variants : []

      const outOfStock = isOutOfStock(variants, availableGrams)

      if (outOfStock) {
        outOfStockProducts += 1
        problematic.push({
          productId: String(product._id),
          productName: typeof product.name === 'string' ? product.name : '',
          availableGrams,
          issue: 'out-of-stock',
        })
      } else {
        const threshold =
          typeof product.lowStockThresholdGrams === 'number' ? product.lowStockThresholdGrams : 0
        if (availableGrams > 0 && availableGrams <= threshold) {
          lowStockProducts += 1
          problematic.push({
            productId: String(product._id),
            productName: typeof product.name === 'string' ? product.name : '',
            availableGrams,
            issue: 'low-stock',
          })
        }
      }
    }

    return {
      lowStockProducts,
      outOfStockProducts,
      problematicProducts: problematic.slice(0, 50),
    }
  }

  // Batch image loading through the media module: a single MongoDB query per
  // catalog page, never a Cloudinary API call and never one query per photo.
  private async loadImages(
    imageIds: string[],
    preset: 'catalog' | 'detail'
  ): Promise<Map<string, LoadedImage>> {
    const result = new Map<string, LoadedImage>()

    if (imageIds.length === 0) {
      return result
    }

    const resolved = await this.mediaAssetsService.resolvePublicImages(imageIds, preset)

    for (const image of resolved) {
      result.set(image.id, {
        id: image.id,
        url: image.url,
        ...(image.alt ? { alt: image.alt } : {}),
        ...(typeof image.width === 'number' ? { width: image.width } : {}),
        ...(typeof image.height === 'number' ? { height: image.height } : {}),
      })
    }

    return result
  }

  private async presentMany(
    rawProducts: Record<string, unknown>[],
    preset: 'catalog' | 'detail' = 'catalog'
  ): Promise<PublicProductView[]> {
    const loaded = rawProducts.map((raw) => toLoadedProduct({ ...raw, status: 'published' }))
    const productIds = loaded.map((product) => new Types.ObjectId(String(product._id)))
    const stocks = await this.inventoryService.getStockForMany(productIds)

    const allImageIds: string[] = []

    for (const product of loaded) {
      for (const id of product.imageIds) {
        allImageIds.push(String(id))
      }
    }

    const images = await this.loadImages(allImageIds, preset)

    return loaded.map((product) => {
      const stock: LoadedStock = stocks.get(String(product._id)) || {
        physicalGrams: 0,
        reservedGrams: 0,
      }
      const productImages: LoadedImage[] = []

      for (const id of product.imageIds) {
        const image = images.get(String(id))

        if (image) {
          productImages.push(image)
        }
      }

      return toPublicProduct(product, productImages, stock)
    })
  }

  async getPublishedByIds(ids: string[]): Promise<PublicProductView[]> {
    const validIds = ids.filter((id) => Types.ObjectId.isValid(id))
    const products = await this.productsRepository.findPublishedByIds(
      validIds.map((id) => new Types.ObjectId(id))
    )
    const presented = await this.presentMany(products as unknown as Record<string, unknown>[])
    const byId = new Map(presented.map((product) => [product.id, product]))
    return validIds.flatMap((id) => {
      const product = byId.get(id)
      return product ? [product] : []
    })
  }

  async getBySlug(slug: string): Promise<PublicProductView> {
    const normalized = slug.trim().toLowerCase()
    const raw = await this.productsRepository.findPublishedBySlug(normalized)

    if (!raw) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found' })
    }

    const presented = await this.presentMany([raw as unknown as Record<string, unknown>], 'detail')
    const first = presented[0]

    if (!first) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found' })
    }

    return first
  }

  async list(query: ProductCatalogQueryDto): Promise<CatalogPage> {
    const page = query.page ?? 1
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT
    const criteria: CatalogCriteria = {
      page,
      limit,
      sort: query.sort ?? 'new',
      search: query.search?.trim(),
      minPrice: query.minPrice === undefined ? undefined : toProductPrice(query.minPrice),
      maxPrice: query.maxPrice === undefined ? undefined : toProductPrice(query.maxPrice),
    }

    if (query.category) {
      const category = query.category.trim()

      if (Types.ObjectId.isValid(category)) {
        criteria.categoryId = new Types.ObjectId(category)
      } else {
        const found = await this.categoriesService.findBySlug(category.toLowerCase())

        if (!found) {
          return { items: [], pagination: { page, limit, totalItems: 0, totalPages: 1 } }
        }

        criteria.categoryId = found._id
      }
    }

    if (query.tastes && query.tastes.length > 0) {
      const tasteIds = query.tastes.map((taste) => {
        if (!Types.ObjectId.isValid(taste)) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: 'tastes must be ObjectIds',
          })
        }

        return new Types.ObjectId(taste)
      })
      criteria.tasteNoteIds = tasteIds
    }

    const { rawItems, totalItems } = await this.productsRepository.listCatalog(criteria)
    const totalPages = Math.max(1, Math.ceil(totalItems / limit))
    const items = await this.presentMany(rawItems)

    return { items, pagination: { page, limit, totalItems, totalPages } }
  }
}
