import type { CatalogFilter, CatalogOption, CatalogResponse } from '../types/catalog'

async function readJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Catalog request failed (HTTP ${response.status})`)
  }
  return (await response.json()) as T
}

export function getCatalogProducts(baseUrl: string, filter: CatalogFilter, signal?: AbortSignal) {
  const params = new URLSearchParams()
  if (filter.search) {
    params.set('search', filter.search)
  }
  if (filter.category) {
    params.set('category', filter.category)
  }
  if (filter.tastes?.length) {
    params.set('tastes', filter.tastes.join(','))
  }
  if (filter.minPrice !== undefined) {
    params.set('minPrice', String(filter.minPrice))
  }
  if (filter.maxPrice !== undefined) {
    params.set('maxPrice', String(filter.maxPrice))
  }
  if (filter.sort) {
    params.set('sort', filter.sort)
  }
  if (filter.page) {
    params.set('page', String(filter.page))
  }
  return readJson<CatalogResponse>(`${baseUrl.replace(/\/$/, '')}/products?${params}`, signal)
}

export async function getCatalogOptions(baseUrl: string, endpoint: 'categories' | 'taste-notes') {
  const result = await readJson<{ items: CatalogOption[] }>(
    `${baseUrl.replace(/\/$/, '')}/${endpoint}`
  )
  return result.items
}
