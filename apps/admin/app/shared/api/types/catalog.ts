export interface Pagination {
  page: number
  limit: number
  totalItems: number
  totalPages: number
}
export interface Page<T> {
  items: T[]
  pagination: Pagination
}
export interface ListQuery {
  search?: string
  page?: number
  status?: string
}
export type DictionaryKind = 'categories' | 'taste-notes'
export interface DictionaryEntry {
  id: string
  name: string
  slug: string
  sortOrder: number
  productsCount: number
}
export type DictionaryInput = Pick<DictionaryEntry, 'name' | 'slug' | 'sortOrder'>
export interface Stock {
  physicalGrams: number
  reservedGrams: number
  availableGrams: number
}
export interface Variant {
  variantId: string
  weightGrams: number
  price: number
  enabled: boolean
}
export type VariantInput = Omit<Variant, 'variantId'>
export interface Product {
  id: string
  name: string
  slug: string
  description: string
  categoryId: string | null
  tasteNoteIds: string[]
  imageIds: string[]
  images: { id: string; url: string; alt?: string }[]
  variants: Variant[]
  status: 'draft' | 'published' | 'archived'
  lowStockThresholdGrams: number
  stock: Stock
  updatedAt: string
}
export interface ProductInput {
  name: string
  description: string
  categoryId: string | null
  tasteNoteIds: string[]
  imageIds: string[]
  lowStockThresholdGrams: number
}
export interface MediaAsset {
  id: string
  name: string
  originalName: string
  alt: string
  url: string | null
  status: string
  usageCount: number
  width: number | null
  height: number | null
}
export interface MediaUsage {
  id: string
  name: string
  status: string
}
export interface Movement {
  id: string
  productId: string
  type: string
  before: Stock
  delta: Stock
  after: Stock
  reason: string | null
  correctionOfId: string | null
  createdAt: string
}
export type StockOperation = 'receipt' | 'write-off' | 'adjust'
export interface MovementResult {
  movementId: string
  stock: Stock
}
