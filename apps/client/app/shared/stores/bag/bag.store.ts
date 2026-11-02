import { create } from 'zustand'
import { persist, type PersistStorage } from 'zustand/middleware'
import type { BagItem, BagStore } from './bag.types'

export const BAG_STORAGE_KEY = 'mokuren-bag'
export const MAX_BAG_QUANTITY = 9
export const MAX_BAG_LINES = 20

type PersistedBag = Pick<BagStore, 'items'>

function readStoredItems(value: unknown): BagItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  const items: BagItem[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue
    }

    // The previous bag stored product IDs and weights without variant IDs.
    const productId: unknown = entry.productId || entry.id
    const weightGrams: unknown = entry.weightGrams || entry.weight
    const quantity: unknown = entry.quantity ?? entry.qty
    const variantId: unknown = entry.variantId || `legacy:${String(weightGrams)}`
    if (
      typeof productId !== 'string' ||
      !/^[a-f\d]{24}$/i.test(productId) ||
      typeof variantId !== 'string' ||
      !variantId ||
      typeof weightGrams !== 'number' ||
      !Number.isInteger(weightGrams) ||
      weightGrams <= 0 ||
      typeof quantity !== 'number' ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      continue
    }

    const existing = items.find(
      (item) => item.productId === productId && item.variantId === variantId
    )
    if (existing) {
      existing.quantity = Math.min(MAX_BAG_QUANTITY, existing.quantity + quantity)
    } else {
      items.push({
        productId,
        variantId,
        weightGrams,
        quantity: Math.min(MAX_BAG_QUANTITY, quantity),
      })
    }
  }
  return items
}

const storage: PersistStorage<PersistedBag> = {
  getItem: (name) => {
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(name) || 'null')
      const source =
        saved && typeof saved === 'object' && 'state' in saved
          ? (saved.state as Partial<PersistedBag> | null)?.items
          : saved
      return { state: { items: readStoredItems(source) }, version: 1 }
    } catch {
      // An inaccessible or malformed saved bag must not prevent hydration.
      return null
    }
  },
  setItem: (name, value) => window.localStorage.setItem(name, JSON.stringify(value)),
  removeItem: (name) => window.localStorage.removeItem(name),
}

export const useBagStore = create<BagStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        if (
          !item.productId ||
          !item.variantId ||
          !Number.isInteger(item.quantity) ||
          item.quantity <= 0 ||
          !Number.isInteger(item.weightGrams) ||
          item.weightGrams <= 0
        ) {
          throw new Error('Invalid bag item')
        }

        const items = get().items
        const existing = items.find(
          (line) =>
            line.productId === item.productId &&
            (line.variantId === item.variantId ||
              (line.variantId.startsWith('legacy:') && line.weightGrams === item.weightGrams))
        )
        if (!existing && items.length >= MAX_BAG_LINES) {
          return 'line-limit'
        }
        const previousQuantity = existing?.quantity || 0
        const quantity = Math.min(MAX_BAG_QUANTITY, previousQuantity + item.quantity)
        set({
          items: existing
            ? items.map((line) => (line === existing ? { ...item, quantity } : line))
            : [...items, { ...item, quantity }],
        })
        return quantity - previousQuantity
      },
      setQuantity: (productId, variantId, quantity) => {
        if (!Number.isInteger(quantity)) {
          return
        }
        set({
          items: get().items.map((line) =>
            line.productId === productId && line.variantId === variantId
              ? { ...line, quantity: Math.max(1, Math.min(MAX_BAG_QUANTITY, quantity)) }
              : line
          ),
        })
      },
      removeItem: (productId, variantId) =>
        set({
          items: get().items.filter(
            (line) => line.productId !== productId || line.variantId !== variantId
          ),
        }),
      removeReservedItems: (submitted) =>
        set({
          items: get().items.flatMap((item) => {
            const reserved = submitted.find(
              (line) =>
                line.productId === item.productId &&
                (line.variantId === item.variantId ||
                  (line.variantId.startsWith('legacy:') && line.weightGrams === item.weightGrams))
            )
            const quantity = item.quantity - (reserved?.quantity || 0)
            return quantity > 0 ? [{ ...item, quantity }] : []
          }),
        }),
      clearBag: () => set({ items: [] }),
    }),
    {
      name: BAG_STORAGE_KEY,
      storage,
      version: 1,
      partialize: ({ items }) => ({ items }),
      skipHydration: true,
    }
  )
)
