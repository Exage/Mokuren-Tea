'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { ListQuery, Page } from '../api/types/catalog'
import { catalogError } from '../api/requests/catalog-request'

export function useCatalogListHook<T>(
  load: (query: ListQuery, signal: AbortSignal) => Promise<Page<T>>,
  status = ''
) {
  const [query, setQuery] = useState<ListQuery>({ page: 1, search: '' })
  const [revision, setRevision] = useState(0)
  const request = useMemo(() => ({ query, status, revision }), [query, status, revision])
  const [result, setResult] = useState<{
    request: typeof request
    data: Page<T> | null
    error: string
  } | null>(null)
  const loading = result?.request !== request
  const data = loading ? null : result?.data || null
  const error = loading ? '' : result?.error || ''
  useEffect(() => {
    const controller = new AbortController()
    load({ ...request.query, status: request.status }, controller.signal)
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
  }, [load, request])
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setQuery({ page: 1, search: String(form.get('search') || '').trim() })
  }
  return {
    data,
    loading,
    error,
    search,
    query,
    setQuerySearch: (search: string) => setQuery({ search, page: 1 }),
    setPage: (page: number) => setQuery((value) => ({ ...value, page })),
    refresh: () => setRevision((value) => value + 1),
  }
}

export function useCatalogMutationHook() {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function run(action: () => Promise<void>, success: string) {
    if (lock.current) {
      return
    }
    lock.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
      setNotice(success)
    } catch (error) {
      setError(catalogError(error))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return { busy, error, notice, run }
}
