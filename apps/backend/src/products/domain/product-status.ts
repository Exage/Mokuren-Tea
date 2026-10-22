export const PRODUCT_STATUSES = ['draft', 'published', 'archived'] as const

export type ProductStatus = (typeof PRODUCT_STATUSES)[number]
