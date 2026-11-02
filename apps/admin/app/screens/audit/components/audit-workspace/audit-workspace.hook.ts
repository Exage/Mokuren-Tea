import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { AuditEntry, AuditQuery } from '@/app/shared/api/types/administration'
import type { Page } from '@/app/shared/api/types/catalog'
import { listAuditEntries } from '@/app/shared/api/requests/audit'
import { catalogError } from '@/app/shared/api/requests/catalog-request'

export function useAuditWorkspaceHook() {
  const [query, setQuery] = useState<AuditQuery>({ page: 1 })
  const [revision, setRevision] = useState(0)
  const [filterError, setFilterError] = useState('')
  const [selected, setSelected] = useState<AuditEntry | null>(null)
  const request = useMemo(() => ({ query, revision }), [query, revision])
  const [result, setResult] = useState<{
    request: typeof request
    data: Page<AuditEntry> | null
    error: string
  } | null>(null)
  const loading = result?.request !== request
  const data = result?.request.query === query ? result.data : null

  useEffect(() => {
    const controller = new AbortController()
    listAuditEntries(request.query, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) {
          return
        }
        if (
          data.pagination.totalPages > 0 &&
          (request.query.page || 1) > data.pagination.totalPages
        ) {
          setQuery((value) => ({ ...value, page: data.pagination.totalPages }))
        } else {
          setResult({ request, data, error: '' })
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({ request, data: null, error: catalogError(error) })
        }
      })
    return () => controller.abort()
  }, [request])

  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const next: AuditQuery = { page: 1 }
    for (const key of ['actorId', 'action', 'entityType', 'entityId'] as const) {
      next[key] = String(form.get(key) || '').trim()
    }
    for (const key of ['from', 'to'] as const) {
      const value = String(form.get(key) || '')
      if (value) {
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) {
          setFilterError('Enter a valid date and time.')
          return
        }
        next[key] = date.toISOString()
      }
    }
    if (next.from && next.to && next.from > next.to) {
      setFilterError('The end date must be on or after the start date.')
      return
    }
    setFilterError('')
    setQuery(next)
  }

  function clear() {
    setFilterError('')
    setQuery({ page: 1 })
  }

  return {
    data,
    loading,
    error: filterError || (!loading && result?.error) || '',
    selected,
    setSelected,
    filter,
    clear,
    setPage: (page: number) => setQuery((value) => ({ ...value, page })),
    refresh: () => setRevision((value) => value + 1),
  }
}
