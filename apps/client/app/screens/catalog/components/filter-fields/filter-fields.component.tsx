import type { CatalogOption } from '@/app/shared/api/types/catalog'
import { Input } from '@mokuren/ui/input'
import styles from './filter-fields.module.css'

type FilterFieldsProps = {
  group: 'price' | 'taste' | 'all'
  minPrice: string
  maxPrice: string
  tastes: string[]
  tasteOptions: CatalogOption[]
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
  tasteOptions,
  onMinPriceChange,
  onMaxPriceChange,
  onPriceBlur,
  onTasteToggle,
}: FilterFieldsProps) {
  return (
    <div className={styles.fields}>
      {group !== 'taste' && (
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Price, BYN</legend>
          <div className={styles.prices}>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={minPrice}
              aria-label="Minimum price"
              onChange={(event) => onMinPriceChange(event.target.value)}
              onBlur={onPriceBlur}
            />
            <span aria-hidden="true">–</span>
            <Input
              type="number"
              min="0"
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
            {tasteOptions.map((taste) => (
              <button
                key={taste.id}
                type="button"
                className={styles.chip}
                aria-pressed={tastes.includes(taste.id)}
                onClick={() => onTasteToggle(taste.id)}
              >
                {taste.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  )
}
