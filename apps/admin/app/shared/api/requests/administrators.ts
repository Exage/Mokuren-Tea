import type { Administrator, AdministratorCredentials } from '../types/administration'
import type { ListQuery, Page } from '../types/catalog'
import { catalogRequest } from './catalog-request'

export function listAdministrators(query: ListQuery, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(query.page || 1), limit: '20' })
  if (query.search) {
    params.set('search', query.search)
  }
  return catalogRequest<Page<Administrator>>(`users?${params}`, { signal })
}

export function createAdministrator(input: { login: string; displayName: string }) {
  return catalogRequest<AdministratorCredentials>('users', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateAdministrator(
  id: string,
  input: { displayName?: string; isActive?: boolean }
) {
  return catalogRequest<Administrator>(`users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function resetAdministratorPassword(id: string) {
  return catalogRequest<AdministratorCredentials>(
    `users/${encodeURIComponent(id)}/reset-password`,
    {
      method: 'POST',
    }
  )
}

export function revokeAdministratorSessions(id: string) {
  return catalogRequest<{ revokedCount: number }>(
    `users/${encodeURIComponent(id)}/revoke-sessions`,
    {
      method: 'POST',
    }
  )
}
