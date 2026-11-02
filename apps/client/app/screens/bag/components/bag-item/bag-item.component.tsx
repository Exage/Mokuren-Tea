import Image from 'next/image'
import Link from 'next/link'
import { MAX_BAG_QUANTITY } from '@/app/shared/stores/bag'
import type { BagLine } from '../../bag.types'
import styles from './bag-item.module.css'

type BagItemProps = {
  line: BagLine
  onQuantityChange: (productId: string, variantId: string, quantity: number) => void
  onRemove: (productId: string, variantId: string) => void
  disabled?: boolean
}

export function BagItem({ line, onQuantityChange, onRemove, disabled }: BagItemProps) {
  const lineTotal = (Math.round(line.unitPrice * 100) * line.quantity) / 100
  const itemLabel = `${line.name}, ${line.weightGrams} g`

  return (
    <li className={styles.item}>
      <Image
        className={styles.image}
        src={line.image || '/images/tea-placeholder.svg'}
        alt={line.name}
        width={96}
        height={96}
        sizes="(max-width: 560px) 72px, 96px"
      />
      <div className={styles.details}>
        <h2 className={styles.name}>
          {line.slug ? <Link href={`/catalog/${line.slug}`}>{line.name}</Link> : line.name}
        </h2>
        <p className={styles.meta}>
          {line.weightGrams} g{line.available && ` · ${line.unitPrice.toFixed(2)} BYN each`}
        </p>
        {!line.available && (
          <p className={styles.unavailable}>This tea or size is no longer available.</p>
        )}
        <div className={styles.actions}>
          <div className={styles.quantity} role="group" aria-label={`Quantity for ${itemLabel}`}>
            <button
              type="button"
              aria-label={`Decrease quantity for ${itemLabel}`}
              disabled={disabled || !line.available || line.quantity <= 1}
              onClick={() => onQuantityChange(line.productId, line.variantId, line.quantity - 1)}
            >
              −
            </button>
            <output aria-label={`Quantity for ${itemLabel}`} aria-live="polite" aria-atomic="true">
              {line.quantity}
            </output>
            <button
              type="button"
              aria-label={`Increase quantity for ${itemLabel}`}
              disabled={disabled || !line.available || line.quantity >= MAX_BAG_QUANTITY}
              onClick={() => onQuantityChange(line.productId, line.variantId, line.quantity + 1)}
            >
              +
            </button>
          </div>
          <button
            className={styles.remove}
            type="button"
            disabled={disabled}
            aria-label={`Remove ${itemLabel} from your bag`}
            onClick={() => onRemove(line.productId, line.variantId)}
          >
            Remove
          </button>
        </div>
      </div>
      <p className={styles.total}>
        {line.available ? `${lineTotal.toFixed(2)} BYN` : 'Unavailable'}
      </p>
    </li>
  )
}
