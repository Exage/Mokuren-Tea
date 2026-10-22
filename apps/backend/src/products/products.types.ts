import type { Types } from 'mongoose'
import type { CatalogSort } from './dto/product-catalog-query.dto.js'
import type { ProductPrice } from './domain/product-price.js'
import type { ProductStatus } from './domain/product-status.js'

export interface LoadedVariant {
  variantId: string
  weightGrams: number
  price: ProductPrice
  enabled: boolean
}

export interface LoadedProduct {
  _id: unknown
  name: string
  slug: string
  description: string
  categoryId: unknown | null
  tasteNoteIds: unknown[]
  imageIds: unknown[]
  variants: LoadedVariant[]
  status: ProductStatus
  firstPublishedAt: Date | null
  lastPublishedAt: Date | null
  lowStockThresholdGrams: number
  createdAt: Date
  updatedAt: Date
}

export interface LoadedImage {
  id: string
  url: string
  alt?: string
  width?: number
  height?: number
}

export interface LoadedStock {
  physicalGrams: number
  reservedGrams: number
}

export interface PublicVariantView {
  variantId: string
  weightGrams: number
  price: number
  available: boolean
}

export interface PublicProductView {
  id: string
  name: string
  slug: string
  description: string
  categoryId: string | null
  tasteNoteIds: string[]
  images: LoadedImage[]
  variants: PublicVariantView[]
  minPrice: number | null
  outOfStock: boolean
  firstPublishedAt: string | null
}

export interface AdminVariantView {
  variantId: string
  weightGrams: number
  price: number
  enabled: boolean
}

export interface AdminProductView {
  id: string
  name: string
  slug: string
  description: string
  categoryId: string | null
  tasteNoteIds: string[]
  imageIds: string[]
  images: LoadedImage[]
  variants: AdminVariantView[]
  status: ProductStatus
  firstPublishedAt: string | null
  lastPublishedAt: string | null
  lowStockThresholdGrams: number
  stock: { physicalGrams: number; reservedGrams: number; availableGrams: number }
  createdAt: string
  updatedAt: string
}

export interface CatalogCriteria {
  page: number
  limit: number
  sort: CatalogSort
  categoryId?: Types.ObjectId
  tasteNoteIds?: Types.ObjectId[]
  search?: string
  minPrice?: ProductPrice
  maxPrice?: ProductPrice
}

export interface ProductStockOverview {
  lowStockProducts: number
  outOfStockProducts: number
  problematicProducts: Array<{
    productId: string
    productName: string
    availableGrams: number
    issue: 'low-stock' | 'out-of-stock'
  }>
}
