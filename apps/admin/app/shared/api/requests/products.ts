import type { ListQuery, Page, Product, ProductInput, VariantInput } from '../types/catalog'
import { catalogRequest } from './catalog-request'

export function listProducts(query: ListQuery, signal?: AbortSignal) {
  return catalogRequest<Page<Product>>(
    `products?${new URLSearchParams({ search: query.search || '', ...(query.status ? { status: query.status } : {}), page: String(query.page || 1), limit: '20' })}`,
    { signal }
  )
}
export function createProduct(input: ProductInput & { slug: string }) {
  const { categoryId, ...body } = input
  return catalogRequest<Product>('products', {
    method: 'POST',
    body: JSON.stringify({ ...body, ...(categoryId ? { categoryId } : {}) }),
  })
}
export function updateProduct(id: string, input: ProductInput) {
  return catalogRequest<Product>(`products/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}
export function changeProductStatus(id: string, action: 'publish' | 'archive') {
  return catalogRequest<Product>(`products/${id}/${action}`, { method: 'POST' })
}
export function saveVariant(productId: string, input: VariantInput, variantId?: string) {
  return catalogRequest<Product>(
    `products/${productId}/variants${variantId ? `/${variantId}` : ''}`,
    { method: variantId ? 'PATCH' : 'POST', body: JSON.stringify(input) }
  )
}
