import type { ListQuery, MediaAsset, MediaUsage, Page } from '../types/catalog'
import { catalogRequest } from './catalog-request'

export function listMedia(query: ListQuery, signal?: AbortSignal) {
  return catalogRequest<Page<MediaAsset>>(
    `media-assets?${new URLSearchParams({ search: query.search || '', status: query.status || 'ready', page: String(query.page || 1), limit: '20' })}`,
    { signal }
  )
}
export function uploadMedia(body: FormData) {
  return catalogRequest<MediaAsset>('media-assets', { method: 'POST', body })
}
export function updateMedia(id: string, input: { name: string; alt: string }) {
  return catalogRequest<MediaAsset>(`media-assets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}
export function mediaUsages(id: string) {
  return catalogRequest<MediaUsage[]>(`media-assets/${id}/usages`)
}
export function deleteMedia(id: string) {
  return catalogRequest<MediaAsset>(`media-assets/${id}`, { method: 'DELETE' })
}
