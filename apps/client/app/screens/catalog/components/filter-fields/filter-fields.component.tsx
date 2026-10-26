import { TASTES } from '../catalog-results/catalog-results.hook'
import styles from './filter-fields.module.css'

type FilterFieldsProps = {
  group: 'price' | 'taste' | 'all'
  minPrice: string
  maxPrice: string
  tastes: string[]
  onMinPriceChange: (value: string) => void
  onMaxPriceChange: (value: string) => void
  onPriceBlur: () => void
  onTasteToggle: (taste: string) => void
}

export function FilterFields({
  group,
  minPrice,
  maxPrice,
  tastes,
  onMinPriceChange,
  onMaxPriceChange,
  onPriceBlur,
  onTasteToggle,
}: FilterFieldsProps) {
  return (
    <div className={styles.fields}>
      {group !== 'taste' && (
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Price, BYN / 50 g</legend>
          <div className={styles.prices}>
            <input
              type="number"
              min="0"
              max="30"
              step="0.1"
              value={minPrice}
              aria-label="Minimum price"
              onChange={(event) => onMinPriceChange(event.target.value)}
              onBlur={onPriceBlur}
            />
            <span aria-hidden="true">–</span>
            <input
              type="number"
              min="0"
              max="30"
              step="0.1"
              value={maxPrice}
              aria-label="Maximum price"
              onChange={(event) => onMaxPriceChange(event.target.value)}
              onBlur={onPriceBlur}
            />
          </div>
        </fieldset>
      )}
      {group !== 'price' && (
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Taste notes</legend>
          <div className={styles.chips}>
            {TASTES.map((taste) => (
              <button
                key={taste}
                type="button"
                className={styles.chip}
                aria-pressed={tastes.includes(taste)}
                onClick={() => onTasteToggle(taste)}
              >
                {taste}
              </button>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  )
}
