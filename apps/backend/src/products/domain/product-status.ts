export const PRODUCT_STATUSES = ['draft', 'published', 'archived'] as const

export type ProductStatus = (typeof PRODUCT_STATUSES)[number]

export function isProductStatus(value: unknown): value is ProductStatus {
  if (typeof value !== 'string') {
    return false
  }

  return (PRODUCT_STATUSES as readonly string[]).includes(value)
}
