import type { ProductDocument } from './schemas/product.schema.js'
import {
  canReserveVariant,
  getAvailableGrams,
  getMinimumPrice,
  isOutOfStock,
} from './domain/product-availability.js'
import { productPriceToNumber } from './domain/product-price.js'
import type {
  AdminProductView,
  LoadedImage,
  LoadedProduct,
  LoadedStock,
  PublicProductView,
} from './products.types.js'

export function toLoadedProduct(
  doc: ProductDocument | LoadedProduct | Record<string, unknown>
): LoadedProduct {
  const plain = (typeof (doc as ProductDocument).toObject === 'function'
    ? (doc as ProductDocument).toObject()
    : (doc as unknown as LoadedProduct)) as unknown as Record<string, unknown>

  return {
    _id: plain._id,
    name: plain.name as string,
    slug: plain.slug as string,
    description: (plain.description as string | undefined) || '',
    categoryId: (plain.categoryId as unknown) || null,
    tasteNoteIds: (plain.tasteNoteIds as unknown[] | undefined) || [],
    imageIds: (plain.imageIds as unknown[] | undefined) || [],
    variants: ((plain.variants as LoadedProduct['variants'] | undefined) || []).map((variant) => ({
      variantId: variant.variantId,
      weightGrams: variant.weightGrams,
      price: variant.price,
      enabled: variant.enabled,
    })),
    status: plain.status as LoadedProduct['status'],
    firstPublishedAt: (plain.firstPublishedAt as Date | null | undefined) || null,
    lastPublishedAt: (plain.lastPublishedAt as Date | null | undefined) || null,
    lowStockThresholdGrams: (plain.lowStockThresholdGrams as number | undefined) || 0,
    createdAt: plain.createdAt as Date,
    updatedAt: plain.updatedAt as Date,
  }
}

function toIdString(value: unknown): string {
  return String(value)
}

function toIsoDate(value: Date | null | undefined): string | null {
  if (!value) {
    return null
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

// Public storefront view: an explicit allowlist of fields. Internal stock
// gram counters never leave the backend through this function.
export function toPublicProduct(
  product: LoadedProduct,
  images: LoadedImage[],
  stock: LoadedStock
): PublicProductView {
  const availableGrams = getAvailableGrams(stock.physicalGrams, stock.reservedGrams)
  const enabledVariants = product.variants.filter((variant) => variant.enabled)
  const minPrice = getMinimumPrice(product.variants)

  return {
    id: toIdString(product._id),
    name: product.name,
    slug: product.slug,
    description: product.description,
    categoryId: product.categoryId ? toIdString(product.categoryId) : null,
    tasteNoteIds: product.tasteNoteIds.map((id) => toIdString(id)),
    images: images.map((image) => ({
      id: image.id,
      url: image.url,
      ...(image.alt ? { alt: image.alt } : {}),
      ...(typeof image.width === 'number' ? { width: image.width } : {}),
      ...(typeof image.height === 'number' ? { height: image.height } : {}),
    })),
    variants: enabledVariants.map((variant) => ({
      variantId: variant.variantId,
      weightGrams: variant.weightGrams,
      price: productPriceToNumber(variant.price),
      available: canReserveVariant(variant, availableGrams),
    })),
    minPrice: minPrice ? productPriceToNumber(minPrice) : null,
    outOfStock: isOutOfStock(product.variants, availableGrams),
    firstPublishedAt: toIsoDate(product.firstPublishedAt),
  }
}

export function toAdminProduct(
  product: LoadedProduct,
  images: LoadedImage[],
  stock: LoadedStock
): AdminProductView {
  const availableGrams = getAvailableGrams(stock.physicalGrams, stock.reservedGrams)

  return {
    id: toIdString(product._id),
    name: product.name,
    slug: product.slug,
    description: product.description,
    categoryId: product.categoryId ? toIdString(product.categoryId) : null,
    tasteNoteIds: product.tasteNoteIds.map((id) => toIdString(id)),
    imageIds: product.imageIds.map((id) => toIdString(id)),
    images: images.map((image) => ({
      id: image.id,
      url: image.url,
      ...(image.alt ? { alt: image.alt } : {}),
      ...(typeof image.width === 'number' ? { width: image.width } : {}),
      ...(typeof image.height === 'number' ? { height: image.height } : {}),
    })),
    variants: product.variants.map((variant) => ({
      variantId: variant.variantId,
      weightGrams: variant.weightGrams,
      price: productPriceToNumber(variant.price),
      enabled: variant.enabled,
    })),
    status: product.status,
    firstPublishedAt: toIsoDate(product.firstPublishedAt),
    lastPublishedAt: toIsoDate(product.lastPublishedAt),
    lowStockThresholdGrams: product.lowStockThresholdGrams,
    stock: {
      physicalGrams: stock.physicalGrams,
      reservedGrams: stock.reservedGrams,
      availableGrams,
    },
    createdAt: toIsoDate(product.createdAt) || new Date(0).toISOString(),
    updatedAt: toIsoDate(product.updatedAt) || new Date(0).toISOString(),
  }
}
