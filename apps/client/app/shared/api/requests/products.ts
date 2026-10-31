import 'server-only'
import type { PublicProduct } from '../types/cms'

export async function getProduct(slug: string): Promise<PublicProduct | null> {
  const baseUrl = process.env.API_URL || 'http://localhost:3001/api'
  const response = await fetch(
    `${baseUrl.replace(/\/$/, '')}/products/${encodeURIComponent(slug)}`,
    {
      cache: 'no-store',
    }
  )
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error(`Failed to load product (HTTP ${response.status})`)
  }
  return (await response.json()) as PublicProduct
}
