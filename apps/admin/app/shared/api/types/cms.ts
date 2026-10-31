export type CmsBlockKey =
  | 'home.hero'
  | 'home.testimonials'
  | 'home.featuredTeas'
  | 'home.visitStore'
  | 'catalog.header'
  | 'about.content'
  | 'contacts.content'

export interface Testimonial {
  name: string
  text: string
  rating?: number
}
export interface CmsContent {
  eyebrow?: string
  title?: string
  subtitle?: string
  body?: string
  imageId?: string
  buttonText?: string
  buttonUrl?: string
  secondaryButtonText?: string
  secondaryButtonUrl?: string
  testimonials?: Testimonial[]
  teaIds?: string[]
}
export interface CmsBlock {
  pageKey: string
  blockKey: CmsBlockKey
  draft: CmsContent | null
  draftVersion: number
  published: CmsContent | null
  publishedVersion: number
  updatedBy: string | null
  updatedAt: string
}
export interface CmsRevision {
  id: string
  pageKey: string
  blockKey: CmsBlockKey
  version: number
  content: CmsContent
  publishedBy: string | null
  publishedAt: string
}
export interface CmsPreview {
  pageKey: string
  blocks: Record<string, CmsContent | null>
}
