import type { PublicProduct } from '../types/cms'

export async function getBagProducts(
  productIds: string[],
  signal?: AbortSignal
): Promise<PublicProduct[]> {
  if (!productIds.length) {
    return []
  }
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
  const params = new URLSearchParams({ ids: [...new Set(productIds)].join(',') })
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/products/by-ids?${params}`, {
    signal,
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`Failed to load bag products (HTTP ${response.status})`)
  }
  return (await response.json()) as PublicProduct[]
}
