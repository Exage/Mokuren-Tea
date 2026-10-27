import 'server-only'
import { cacheLife } from 'next/cache'
import type { PublicProduct } from '../types/cms'

export async function getProduct(slug: string): Promise<PublicProduct | null> {
  'use cache'
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 })
  const baseUrl = process.env.API_URL || 'http://localhost:3001/api'
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/products/${encodeURIComponent(slug)}`)
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error(`Failed to load product (HTTP ${response.status})`)
  }
  return (await response.json()) as PublicProduct
}
