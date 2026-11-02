import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  getReservation,
  getReservationEvents,
  listReservations,
  transitionReservation,
} from '@/app/shared/api/requests/reservations'
import type { ReservationAction } from '@/app/shared/api/requests/reservations'
import type {
  Reservation,
  ReservationEvent,
  ReservationListItem,
  ReservationQuery,
} from '@/app/shared/api/types/reservations'
import { reservationStatuses } from '@/app/shared/api/types/reservations'
import type { Page } from '@/app/shared/api/types/catalog'
import { catalogError } from '@/app/shared/api/requests/catalog-request'
import { useCatalogMutationHook } from '@/app/shared/hooks/catalog-data.hook'

export function useReservationsWorkspaceHook() {
  const params = useSearchParams()
  const initialStatus = params.get('status') || ''
  const [query, setQuery] = useState<ReservationQuery>({
    page: 1,
    status: reservationStatuses.some((s) => s.value === initialStatus) ? initialStatus : '',
  })
  const [revision, setRevision] = useState(0)
  const [filterError, setFilterError] = useState('')
  const [id, setId] = useState<string | null>(params.get('id'))
  const [editor, setEditor] = useState<Reservation | 'create' | null>(null)
  const [pending, setPending] = useState<ReservationAction | null>(null)
  const [teaReturned, setTeaReturned] = useState(false)
  const mutation = useCatalogMutationHook()
  const request = useMemo(() => ({ query, revision }), [query, revision])
  const detailRequest = useMemo(() => ({ id, revision }), [id, revision])
  const [result, setResult] = useState<{
    request: typeof request
    data: Page<ReservationListItem> | null
    error: string
  } | null>(null)
  const [detail, setDetail] = useState<{
    request: typeof detailRequest
    data: Reservation | null
    events: ReservationEvent[]
    error: string
  } | null>(null)
  const loading = result?.request !== request
  const detailLoading = !!id && detail?.request !== detailRequest
  const selected = !detailLoading && id ? detail?.data || null : null
  useEffect(() => {
    const controller = new AbortController()
    listReservations(request.query, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          if (
            data.pagination.totalPages > 0 &&
            (request.query.page || 1) > data.pagination.totalPages
          ) {
            setQuery((value) => ({ ...value, page: data.pagination.totalPages }))
          } else {
            setResult({ request, data, error: '' })
          }
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({ request, data: null, error: catalogError(error) })
        }
      })
    return () => controller.abort()
  }, [request])
  useEffect(() => {
    if (!detailRequest.id) {
      return
    }
    const controller = new AbortController()
    Promise.all([
      getReservation(detailRequest.id, controller.signal),
      getReservationEvents(detailRequest.id, controller.signal),
    ])
      .then(([data, events]) => {
        if (!controller.signal.aborted) {
          setDetail({ request: detailRequest, data, events, error: '' })
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setDetail({ request: detailRequest, data: null, events: [], error: catalogError(error) })
        }
      })
    return () => controller.abort()
  }, [detailRequest])
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const next: ReservationQuery = { page: 1, status: query.status, source: query.source }
    for (const key of ['customerName', 'customerPhone'] as const) {
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
  function refresh() {
    setRevision((value) => value + 1)
  }
  function confirm() {
    if (!selected || !pending) {
      return
    }
    void mutation.run(async () => {
      await transitionReservation(selected.id, pending, teaReturned)
      setPending(null)
      refresh()
    }, 'Reservation updated.')
  }
  return {
    query,
    setQuery,
    filter,
    loading,
    data: loading ? null : result?.data,
    error: filterError || (!loading && result?.error) || '',
    refresh,
    setPage: (page: number) => setQuery((value) => ({ ...value, page })),
    id,
    select: (value: string | null) => {
      setPending(null)
      mutation.clearFeedback()
      setId(value)
    },
    selected,
    detailLoading,
    detailError: !detailLoading && id ? detail?.error : '',
    events: detailLoading ? [] : detail?.events || [],
    editor,
    setEditor,
    pending,
    prepare: (action: ReservationAction) => {
      setTeaReturned(false)
      setPending(action)
      mutation.clearFeedback()
    },
    setPending,
    teaReturned,
    setTeaReturned,
    mutation,
    confirm,
    saved: (reservation: Reservation) => {
      setEditor(null)
      setId(reservation.id)
      refresh()
    },
  }
}
