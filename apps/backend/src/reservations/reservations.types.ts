export type ReservationStatus = 'new' | 'confirmed' | 'ready' | 'completed' | 'cancelled'

export const RESERVATION_STATUSES: ReservationStatus[] = [
  'new',
  'confirmed',
  'ready',
  'completed',
  'cancelled',
]

export type ReservationSource = 'website' | 'admin'

export const RESERVATION_SOURCES: ReservationSource[] = ['website', 'admin']

export interface ReservationLineSnapshot {
  productId: string
  productName: string
  variantId: string
  variantWeightGrams: number
  variantPrice: number
  quantity: number
  lineTotal: number
  grams: number
}

export interface ReservationView {
  id: string
  number: string
  source: ReservationSource
  customerName: string
  customerPhone: string
  status: ReservationStatus
  lines: ReservationLineSnapshot[]
  totalGrams: number
  totalAmount: number
  createdByAdminId?: string | null
  createdAt: string
  updatedAt: string
}

export interface ReservationListItem {
  id: string
  number: string
  source: ReservationSource
  customerName: string
  customerPhone: string
  status: ReservationStatus
  totalGrams: number
  totalAmount: number
  createdAt: string
}

export interface ReservationList {
  items: ReservationListItem[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
}

export interface ReservationLineInput {
  productId: string
  variantId: string
  quantity: number
}

export interface CreateReservationInput {
  source: ReservationSource
  customerName: string
  customerPhone: string
  lines: ReservationLineInput[]
  actorId?: string | null
}

export interface ReservationFilters {
  status?: ReservationStatus
  source?: ReservationSource
  customerName?: string
  customerPhone?: string
  from?: Date
  to?: Date
  page?: number
  limit?: number
}

export interface ReservationEventView {
  id: string
  action: 'created' | 'edited' | 'status-changed'
  oldStatus: string | null
  newStatus: string | null
  changes: Record<string, unknown> | null
  actorId: string | null
  createdAt: string
}

export interface ActiveReservationsOverview {
  counts: { new: number; confirmed: number; ready: number }
  recent: Array<{
    id: string
    number: string
    customerName: string
    status: 'new' | 'confirmed' | 'ready'
    totalGrams: number
    createdAt: string
  }>
}
