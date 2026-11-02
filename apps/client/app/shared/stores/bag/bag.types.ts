export type BagItem = {
  productId: string
  variantId: string
  weightGrams: number
  quantity: number
}

export type BagStore = {
  items: BagItem[]
  addItem: (item: BagItem) => number | 'line-limit'
  setQuantity: (productId: string, variantId: string, quantity: number) => void
  removeItem: (productId: string, variantId: string) => void
  removeReservedItems: (items: BagItem[]) => void
  clearBag: () => void
}
