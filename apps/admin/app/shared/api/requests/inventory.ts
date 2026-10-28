import type { Movement, MovementResult, Page, Stock, StockOperation } from '../types/catalog'
import { catalogRequest } from './catalog-request'

export function getProductStock(id: string, signal?: AbortSignal) {
  return catalogRequest<Stock>(`inventory/${id}/stock`, { signal })
}
export function listMovements(productId: string, page: number, signal?: AbortSignal) {
  return catalogRequest<Page<Movement>>(
    `inventory/movements?${new URLSearchParams({ productId, page: String(page), limit: '20' })}`,
    { signal }
  )
}
export function recordStock(
  operation: StockOperation,
  productId: string,
  grams: number,
  reason: string,
  key: string
) {
  return catalogRequest<MovementResult>(`inventory/${operation}`, {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify({
      productId,
      reason,
      ...(operation === 'adjust' ? { targetPhysicalGrams: grams } : { grams }),
    }),
  })
}
export function compensateMovement(movementId: string, reason: string, key: string) {
  return catalogRequest<MovementResult>('inventory/compensate', {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify({ movementId, reason }),
  })
}
