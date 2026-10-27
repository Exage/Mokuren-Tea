import 'server-only'
import { cacheLife } from 'next/cache'
import { getCatalogOptions, getCatalogProducts } from './catalog'
import type { CatalogInitialData } from '../types/catalog'

export async function getInitialCatalog(): Promise<CatalogInitialData> {
  'use cache'
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 })
  const baseUrl = process.env.API_URL || 'http://localhost:3001/api'
  const [products, categories, tastes] = await Promise.all([
    getCatalogProducts(baseUrl, {}),
    getCatalogOptions(baseUrl, 'categories'),
    getCatalogOptions(baseUrl, 'taste-notes'),
  ])
  return { products, categories, tastes }
}
