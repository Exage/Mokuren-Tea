export type BagLine = {
  productId: string
  variantId: string
  reservationVariantId?: string
  name: string
  image: string
  weightGrams: number
  unitPrice: number
  quantity: number
  slug?: string
  available: boolean
}
