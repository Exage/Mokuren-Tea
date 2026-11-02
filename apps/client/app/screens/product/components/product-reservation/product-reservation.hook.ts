import { useEffect, useId, useState } from 'react'
import type { PublicProduct } from '@/app/shared/api/types/cms'
import { useBagStore, useBagHydrationHook, MAX_BAG_LINES } from '@/app/shared/stores/bag'

export function useProductReservationHook(product: PublicProduct) {
  const hasHydrated = useBagHydrationHook()
  const addItem = useBagStore((state) => state.addItem)
  const id = useId()
  const [weight, setWeight] = useState(
    product.variants.find((variant) => variant.available)?.weightGrams || 0
  )
  const [quantity, setQuantity] = useState(1)
  const [feedback, setFeedback] = useState({ message: '', revision: 0 })
  const variant = product.variants.find((item) => item.weightGrams === weight && item.available)
  const price = variant?.price.toFixed(2) || ''

  const addToBag = () => {
    if (!variant || !hasHydrated) {
      return
    }
    try {
      const addedQuantity = addItem({
        productId: product.id,
        variantId: variant.variantId,
        weightGrams: variant.weightGrams,
        quantity,
      })
      const message =
        addedQuantity === 'line-limit'
          ? `Your bag can contain up to ${MAX_BAG_LINES} different teas and sizes.`
          : addedQuantity
            ? `${product.name} (${weight} g × ${addedQuantity}) added to your reservation.`
            : 'Your reservation already contains the maximum of 9 packs for this size.'
      setFeedback((previous) => ({ message, revision: previous.revision + 1 }))
    } catch {
      setFeedback((previous) => ({
        message: 'Your bag was updated, but could not be saved on this device. Please try again.',
        revision: previous.revision + 1,
      }))
    }
  }

  useEffect(() => {
    if (!feedback.message) {
      return
    }

    const timeout = window.setTimeout(() => {
      setFeedback((previous) => ({ ...previous, message: '' }))
    }, 4000)

    return () => window.clearTimeout(timeout)
  }, [feedback.message, feedback.revision])

  return {
    id,
    weight,
    setWeight,
    quantity,
    decreaseQuantity: () => setQuantity((previous) => Math.max(1, previous - 1)),
    increaseQuantity: () => setQuantity((previous) => Math.min(9, previous + 1)),
    price,
    variant,
    hasHydrated,
    addToBag,
    message: feedback.message,
  }
}
