export type ReservationInput = {
  source: 'website'
  customerName: string
  customerPhone: string
  lines: { productId: string; variantId: string; quantity: number }[]
}

export type ReservationReceipt = {
  id: string
  number: string
  status: 'new' | 'confirmed' | 'ready' | 'completed' | 'cancelled'
  totalAmount: number
}
