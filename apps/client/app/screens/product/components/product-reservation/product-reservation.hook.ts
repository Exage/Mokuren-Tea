import { useEffect, useId, useState } from 'react'
import type { PublicProduct } from '@/app/shared/api/types/cms'
import { addToReservation } from '@/app/shared/utils/reservation-bag'

export function useProductReservationHook(product: PublicProduct) {
  const id = useId()
  const [weight, setWeight] = useState(
    product.variants.find((variant) => variant.available)?.weightGrams || 0
  )
  const [quantity, setQuantity] = useState(1)
  const [feedback, setFeedback] = useState({ message: '', revision: 0 })
  const variant = product.variants.find((item) => item.weightGrams === weight && item.available)
  const price = variant?.price.toFixed(2) || ''

  const addToBag = () => {
    if (!variant) {
      return
    }
    try {
      const addedQuantity = addToReservation(product.id, weight, quantity)
      const message = addedQuantity
        ? `${product.name} (${weight} g × ${addedQuantity}) added to your reservation.`
        : 'Your reservation already contains the maximum of 9 packs for this size.'
      setFeedback((previous) => ({ message, revision: previous.revision + 1 }))
    } catch {
      setFeedback((previous) => ({
        message: 'Your reservation could not be saved. Please try again.',
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
    addToBag,
    message: feedback.message,
  }
}
