'use client'

import { Button } from '@mokuren/ui/button'
import type { PublicProduct } from '@/app/shared/api/types/cms'
import { useProductReservationHook } from './product-reservation.hook'
import styles from './product-reservation.module.css'

export function ProductReservation({ product }: { product: PublicProduct }) {
  const {
    id,
    weight,
    setWeight,
    quantity,
    decreaseQuantity,
    increaseQuantity,
    price,
    variant,
    addToBag,
    message,
  } = useProductReservationHook(product)

  return (
    <>
      <p className={styles.price} aria-live="polite" aria-atomic="true">
        {variant ? (
          <>
            {price} BYN <span>/ {weight} g</span>
          </>
        ) : (
          'Out of stock'
        )}
      </p>

      <div className={styles.label} id={`${id}-packaging`}>
        Packaging
      </div>
      <div className={styles.weights} role="group" aria-labelledby={`${id}-packaging`}>
        {product.variants.map((item) => (
          <button
            key={item.variantId}
            type="button"
            className={styles.weight}
            aria-pressed={weight === item.weightGrams}
            disabled={!item.available}
            onClick={() => setWeight(item.weightGrams)}
          >
            {item.weightGrams} g
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
        <Button className={styles.add} type="button" disabled={!variant} onClick={addToBag}>
          Add to Reservation
        </Button>
      </div>

      <div className={styles.feedback} role="status" aria-live="polite" aria-atomic="true">
        {message && <p className={styles.toast}>{message}</p>}
      </div>
    </>
  )
}
