export type ReservationStatus = 'new' | 'confirmed' | 'ready' | 'completed' | 'cancelled'
export const reservationStatuses: { value: ReservationStatus; label: string }[] = [
  { value: 'new', label: 'New request' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'ready', label: 'Ready for pickup' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]
export function reservationStatusLabel(status: string) {
  return reservationStatuses.find((item) => item.value === status)?.label || status
}
export interface ReservationLineInput {
  productId: string
  variantId: string
  quantity: number
}
export interface ReservationLine extends ReservationLineInput {
  productName: string
  variantWeightGrams: number
  variantPrice: number
  lineTotal: number
  grams: number
}
export interface ReservationListItem {
  id: string
  number: string
  source: 'website' | 'admin'
  customerName: string
  customerPhone: string
  status: ReservationStatus
  totalGrams: number
  totalAmount: number
  createdAt: string
}
export interface Reservation extends ReservationListItem {
  lines: ReservationLine[]
  updatedAt: string
}
export interface ReservationInput {
  customerName: string
  customerPhone: string
  lines: ReservationLineInput[]
}
export interface ReservationEvent {
  id: string
  action: string
  oldStatus: string | null
  newStatus: string | null
  changes: Record<string, unknown> | null
  actorId: string | null
  createdAt: string
}
export interface ReservationQuery {
  page?: number
  status?: string
  source?: string
  customerName?: string
  customerPhone?: string
  from?: string
  to?: string
}
export interface Dashboard {
  reservations: { new: number; confirmed: number; ready: number }
  stock: {
    lowStockProducts: number
    outOfStockProducts: number
    problematicProducts: {
      productId: string
      productName: string
      availableGrams: number
      issue: 'low-stock' | 'out-of-stock'
    }[]
  }
  recentReservations: Pick<
    ReservationListItem,
    'id' | 'number' | 'customerName' | 'status' | 'totalGrams' | 'createdAt'
  >[]
}
