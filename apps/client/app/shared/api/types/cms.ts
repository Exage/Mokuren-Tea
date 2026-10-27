export type CmsPageKey = 'home' | 'catalog' | 'about' | 'contacts'

export type PublicImage = { id: string; url: string; alt?: string; width?: number; height?: number }
export type PublicProduct = {
  id: string
  slug: string
  name: string
  description: string
  images: PublicImage[]
  minPrice: number | null
  outOfStock: boolean
  variants: { variantId: string; weightGrams: number; price: number; available: boolean }[]
}
export type CmsBlock = {
  content: Record<string, unknown> | null
  version: number
  image: PublicImage | null
  products: PublicProduct[]
}

export type CmsPage = {
  pageKey: CmsPageKey
  blocks: Record<string, CmsBlock>
}

export function cmsText(content: Record<string, unknown> | null | undefined, field: string) {
  const value = content?.[field]
  return typeof value === 'string' && value.trim() ? value : undefined
}
