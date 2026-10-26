import { useEffect, useId, useState } from 'react'
import type { Product } from '@/app/shared/interface/product'
import { addToReservation, RESERVATION_WEIGHTS } from '@/app/shared/utils/reservation-bag'

const PRICE_MULTIPLIERS = { 50: 1, 100: 1.8, 200: 3.2 } as const

export function useProductReservationHook(product: Product) {
  const id = useId()
  const [weight, setWeight] = useState<(typeof RESERVATION_WEIGHTS)[number]>(100)
  const [quantity, setQuantity] = useState(1)
  const [feedback, setFeedback] = useState({ message: '', revision: 0 })
  const price = (product.price * PRICE_MULTIPLIERS[weight]).toFixed(2)

  const addToBag = () => {
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
    addToBag,
    message: feedback.message,
  }
}
