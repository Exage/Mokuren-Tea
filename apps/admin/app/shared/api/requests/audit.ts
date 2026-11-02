import type { AuditEntry, AuditQuery } from '../types/administration'
import type { Page } from '../types/catalog'
import { catalogRequest } from './catalog-request'

export function listAuditEntries(query: AuditQuery, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(query.page || 1), limit: '20' })
  for (const key of ['actorId', 'action', 'entityType', 'entityId', 'from', 'to'] as const) {
    const value = query[key]
    if (value) {
      params.set(key, value)
    }
  }
  return catalogRequest<Page<AuditEntry>>(`audit?${params}`, { signal })
}
