import type { CmsBlockDocument } from './schemas/cms-block.schema.js'
import type { CmsBlockView } from './cms.types.js'

export function toCmsBlockView(doc: CmsBlockDocument): CmsBlockView {
  return {
    pageKey: doc.pageKey,
    blockKey: doc.blockKey,
    draft: doc.draft ?? null,
    draftVersion: doc.draftVersion,
    published: doc.published ?? null,
    publishedVersion: doc.publishedVersion,
    updatedBy: doc.updatedBy ?? null,
    updatedAt: doc.updatedAt.toISOString(),
  }
}
