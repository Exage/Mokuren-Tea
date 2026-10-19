export interface LoadedCategory {
  _id: unknown
  name: string
  slug: string
  sortOrder: number
  referenceRevision: number
  createdAt: Date
  updatedAt: Date
}

export interface PublicCategoryView {
  id: string
  name: string
  slug: string
  sortOrder: number
}

export interface AdminCategoryView {
  id: string
  name: string
  slug: string
  sortOrder: number
  createdAt: string
  updatedAt: string
  productsCount: number
}
