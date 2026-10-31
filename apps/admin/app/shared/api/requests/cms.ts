import type { Page } from '../types/catalog'
import type { CmsBlock, CmsContent, CmsPreview, CmsRevision } from '../types/cms'
import { catalogRequest } from './catalog-request'

function blockPath(block: Pick<CmsBlock, 'pageKey' | 'blockKey'>) {
  return `cms/blocks/${encodeURIComponent(block.pageKey)}/${encodeURIComponent(block.blockKey)}`
}
export function listCmsBlocks(signal?: AbortSignal) {
  return catalogRequest<Page<CmsBlock>>('cms/blocks', { signal })
}
export function saveCmsDraft(block: CmsBlock, content: CmsContent) {
  return catalogRequest<CmsBlock>(`${blockPath(block)}/draft`, {
    method: 'PATCH',
    body: JSON.stringify({
      pageKey: block.pageKey,
      blockKey: block.blockKey,
      content,
      expectedDraftVersion: block.draftVersion,
    }),
  })
}
export function publishCmsBlock(block: CmsBlock) {
  return catalogRequest<CmsBlock>(`${blockPath(block)}/publish`, {
    method: 'POST',
    body: JSON.stringify({ pageKey: block.pageKey, blockKey: block.blockKey }),
  })
}
export function listCmsRevisions(block: CmsBlock, signal?: AbortSignal) {
  return catalogRequest<Page<CmsRevision>>(`${blockPath(block)}/revisions`, { signal })
}
export function restoreCmsRevision(block: CmsBlock, revisionId: string) {
  return catalogRequest<CmsBlock>(
    `${blockPath(block)}/revisions/${encodeURIComponent(revisionId)}/restore`,
    {
      method: 'POST',
      body: JSON.stringify({ pageKey: block.pageKey, blockKey: block.blockKey, revisionId }),
    }
  )
}
export function previewCmsPage(block: CmsBlock) {
  return catalogRequest<CmsPreview>(
    `cms/preview/${encodeURIComponent(block.pageKey)}/${encodeURIComponent(block.blockKey)}`
  )
}
