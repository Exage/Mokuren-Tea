import type { PublicProduct } from './cms'

export type CatalogFilter = {
  search?: string
  category?: string
  tastes?: string[]
  minPrice?: number
  maxPrice?: number
  sort?: 'new' | 'price-asc' | 'price-desc'
  page?: number
}

export type CatalogResponse = {
  items: PublicProduct[]
  pagination: { page: number; limit: number; totalItems: number; totalPages: number }
}

export type CatalogOption = { id: string; name: string; slug: string; sortOrder: number }
export type CatalogInitialData = {
  products: CatalogResponse
  categories: CatalogOption[]
  tastes: CatalogOption[]
}
