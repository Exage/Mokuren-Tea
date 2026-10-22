export type CmsBlockKey =
  | 'home.hero'
  | 'home.testimonials'
  | 'home.featuredTeas'
  | 'home.visitStore'
  | 'catalog.header'
  | 'about.content'
  | 'contacts.content'

export const CMS_BLOCK_KEYS: CmsBlockKey[] = [
  'home.hero',
  'home.testimonials',
  'home.featuredTeas',
  'home.visitStore',
  'catalog.header',
  'about.content',
  'contacts.content',
]

export interface CmsBlockContent {
  [key: string]: unknown
}

export interface CmsBlockView {
  pageKey: string
  blockKey: CmsBlockKey
  draft: CmsBlockContent | null
  draftVersion: number
  published: CmsBlockContent | null
  publishedVersion: number
  updatedBy: string | null
  updatedAt: string
}

export interface CmsRevisionView {
  id: string
  pageKey: string
  blockKey: CmsBlockKey
  version: number
  content: CmsBlockContent
  publishedBy: string | null
  publishedAt: string
}

export interface CmsRevisionList {
  items: CmsRevisionView[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
}

export interface CmsPagePreview {
  pageKey: string
  blocks: Record<string, CmsBlockContent | null>
}

export interface SaveCmsDraftInput {
  pageKey: string
  blockKey: CmsBlockKey
  content: CmsBlockContent
  expectedDraftVersion: number
  actorId?: string | null
}

export interface PublishCmsBlockInput {
  pageKey: string
  blockKey: CmsBlockKey
  actorId?: string | null
}

export interface RestoreCmsRevisionInput {
  pageKey: string
  blockKey: CmsBlockKey
  revisionId: string
  actorId?: string | null
}

export interface CmsBlockFilters {
  pageKey?: string
  blockKey?: CmsBlockKey
  page?: number
  limit?: number
}

export interface CmsBlockList {
  items: CmsBlockView[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
}
