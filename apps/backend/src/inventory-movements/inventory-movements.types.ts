export type InventoryMovementType =
  'receipt' | 'write-off' | 'adjustment' | 'compensation' | 'reserve' | 'complete' | 'release'

export const INVENTORY_MOVEMENT_TYPES: InventoryMovementType[] = [
  'receipt',
  'write-off',
  'adjustment',
  'compensation',
  'reserve',
  'complete',
  'release',
]

export interface StockSnapshot {
  physicalGrams: number
  reservedGrams: number
}

export interface StockDelta {
  physicalGrams: number
  reservedGrams: number
}

export interface InventoryMovementView {
  id: string
  productId: string
  type: InventoryMovementType
  before: StockSnapshot
  delta: StockDelta
  after: StockSnapshot
  reason: string | null
  reservationId: string | null
  correctionOfId: string | null
  actorId: string | null
  createdAt: string
}

export interface InventoryMovementFilters {
  productId?: string
  type?: InventoryMovementType
  reservationId?: string
  correctionOfId?: string
  from?: Date
  to?: Date
  page?: number
  limit?: number
}

export interface InventoryMovementList {
  items: InventoryMovementView[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
}

export type CreateMovementResult = {
  movementId: string
  stock: { physicalGrams: number; reservedGrams: number; availableGrams: number }
}
