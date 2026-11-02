import type { Page } from '../types/catalog'
import type {
  Reservation,
  ReservationEvent,
  ReservationInput,
  ReservationListItem,
  ReservationQuery,
} from '../types/reservations'
import { catalogRequest } from './catalog-request'

export function listReservations(query: ReservationQuery, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(query.page || 1), limit: '20' })
  for (const key of ['status', 'source', 'customerName', 'customerPhone', 'from', 'to'] as const) {
    if (query[key]) {
      params.set(key, query[key])
    }
  }
  return catalogRequest<Page<ReservationListItem>>(`reservations?${params}`, { signal })
}
export function getReservation(id: string, signal?: AbortSignal) {
  return catalogRequest<Reservation>(`reservations/${encodeURIComponent(id)}`, { signal })
}
export function getReservationEvents(id: string, signal?: AbortSignal) {
  return catalogRequest<ReservationEvent[]>(`reservations/${encodeURIComponent(id)}/events`, {
    signal,
  })
}
export function createReservation(input: ReservationInput) {
  return catalogRequest<Reservation>('reservations', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
export function updateReservation(id: string, input: Partial<ReservationInput>) {
  return catalogRequest<Reservation>(`reservations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}
export type ReservationAction = 'confirm' | 'ready' | 'complete' | 'cancel'
export function transitionReservation(id: string, action: ReservationAction, teaReturned = false) {
  return catalogRequest<Reservation>(`reservations/${encodeURIComponent(id)}/${action}`, {
    method: 'POST',
    ...(action === 'cancel' ? { body: JSON.stringify({ teaReturned }) } : {}),
  })
}
