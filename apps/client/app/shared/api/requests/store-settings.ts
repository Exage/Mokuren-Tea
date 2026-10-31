import 'server-only'
import { cacheLife } from 'next/cache'
import type { StoreSettings } from '../types/store-settings'

export async function getStoreSettings(): Promise<StoreSettings | null> {
  'use cache'
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 })
  const baseUrl = process.env.API_URL || 'http://localhost:3001/api'
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/public/store-settings`)
  if (!response.ok) {
    throw new Error(`Failed to load store settings (HTTP ${response.status})`)
  }
  return (await response.json()) as StoreSettings | null
}
