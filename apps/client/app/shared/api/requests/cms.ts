import 'server-only'
import { cacheLife } from 'next/cache'
import type { CmsPage, CmsPageKey } from '../types/cms'

export async function getCmsPage(page: CmsPageKey): Promise<CmsPage> {
  'use cache'
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 })

  const baseUrl = process.env.API_URL || 'http://localhost:3001/api'
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/public/cms/pages/${page}`)
  if (!response.ok) {
    throw new Error(`Failed to load ${page} content (HTTP ${response.status})`)
  }
  return (await response.json()) as CmsPage
}
