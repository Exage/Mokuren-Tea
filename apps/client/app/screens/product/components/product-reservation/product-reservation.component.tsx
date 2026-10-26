'use client'

import { Button } from '@/app/shared/components/button'
import type { Product } from '@/app/shared/interface/product'
import { RESERVATION_WEIGHTS } from '@/app/shared/utils/reservation-bag'
import { useProductReservationHook } from './product-reservation.hook'
import styles from './product-reservation.module.css'

export function ProductReservation({ product }: { product: Product }) {
  const {
    id,
    weight,
    setWeight,
    quantity,
    decreaseQuantity,
    increaseQuantity,
    price,
    addToBag,
    message,
  } = useProductReservationHook(product)

  return (
    <>
      <p className={styles.price} aria-live="polite" aria-atomic="true">
        {price} BYN <span>/ {weight} g</span>
      </p>

      <div className={styles.label} id={`${id}-packaging`}>
        Packaging
      </div>
      <div className={styles.weights} role="group" aria-labelledby={`${id}-packaging`}>
        {RESERVATION_WEIGHTS.map((grams) => (
          <button
            key={grams}
            type="button"
            className={styles.weight}
            aria-pressed={weight === grams}
            onClick={() => setWeight(grams)}
          >
            {grams} g
          </button>
        ))}
      </div>

      <div className={styles.label} id={`${id}-quantity`}>
        Quantity
      </div>
      <div className={styles.actions}>
        <div className={styles.quantity} role="group" aria-labelledby={`${id}-quantity`}>
          <button
            type="button"
            aria-label="Decrease quantity"
            disabled={quantity === 1}
            onClick={decreaseQuantity}
          >
            −
          </button>
          <output aria-label="Quantity" aria-live="polite">
            {quantity}
          </output>
          <button
            type="button"
            aria-label="Increase quantity"
            disabled={quantity === 9}
            onClick={increaseQuantity}
          >
            +
          </button>
        </div>
        <Button className={styles.add} type="button" onClick={addToBag}>
          Add to Reservation
        </Button>
      </div>

      <div className={styles.feedback} role="status" aria-live="polite" aria-atomic="true">
        {message && <p className={styles.toast}>{message}</p>}
      </div>
    </>
  )
}
