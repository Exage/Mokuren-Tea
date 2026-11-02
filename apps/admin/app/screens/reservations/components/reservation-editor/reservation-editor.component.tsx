'use client'
import clsx from 'clsx'
import local from './reservation-editor.module.css'
import { Button } from '@mokuren/ui/button'
import { Input } from '@mokuren/ui/input'
import { EditorModal } from '@/app/shared/components/editor-modal'
import { CatalogFeedback, CatalogPagination } from '@/app/shared/components/catalog-ui'
import type { Reservation } from '@/app/shared/api/types/reservations'
import { useReservationEditorHook } from './reservation-editor.hook'
import styles from '@/app/shared/components/catalog-ui/catalog-ui.module.css'

export function ReservationEditor({
  reservation,
  onSaved,
  onClose,
}: {
  reservation: Reservation | null
  onSaved: (value: Reservation) => void
  onClose: () => void
}) {
  const h = useReservationEditorHook(reservation, onSaved)
  return (
    <EditorModal
      label={reservation ? `Edit ${reservation.number}` : 'Create reservation'}
      onClose={onClose}
      busy={h.mutation.busy}
    >
      <form className={clsx(styles.stack, local.form)} onSubmit={h.save}>
        <h2>{reservation ? `Edit ${reservation.number}` : 'Create reservation'}</h2>
        <CatalogFeedback error={h.mutation.error} />
        <fieldset className={styles.fields} disabled={h.mutation.busy}>
          <label className={styles.field}>
            Customer name
            <Input
              name="customerName"
              defaultValue={reservation?.customerName}
              required
              maxLength={200}
              pattern=".*\S.*"
            />
          </label>
          <label className={styles.field}>
            Phone
            <Input
              name="customerPhone"
              type="tel"
              defaultValue={reservation?.customerPhone}
              required
              maxLength={50}
              pattern=".*\S.*"
            />
          </label>
          <h3>Reservation items</h3>
          {h.lines.map((line, index) => (
            <div className={styles.card} key={`${line.productId}-${line.variantId}`}>
              <p>
                {line.productName} · {line.variantWeightGrams} g · {line.variantPrice.toFixed(2)}{' '}
                BYN per pack
              </p>
              <label className={styles.field}>
                Quantity
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  step={1}
                  required
                  value={line.quantity || ''}
                  onChange={(event) =>
                    h.setLines((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, quantity: Number(event.target.value) } : item
                      )
                    )
                  }
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                onClick={() => h.setLines((current) => current.filter((_, i) => i !== index))}
              >
                Remove item
              </Button>
            </div>
          ))}
          {!h.lines.length && <p>Add at least one item.</p>}
          <details className={styles.card}>
            <summary>Add tea · {h.lines.length}/20 items</summary>
            <label className={styles.field}>
              Find published tea
              <Input
                type="search"
                maxLength={300}
                onChange={(event) => h.products.setQuerySearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                  }
                }}
              />
            </label>
            <CatalogFeedback loading={h.products.loading} error={h.products.error} />
            {h.products.error && (
              <Button type="button" variant="ghost" onClick={h.products.refresh}>
                Retry
              </Button>
            )}
            {!h.products.loading &&
              h.products.data?.items.map((product) => (
                <div className={styles.card} key={product.id}>
                  <strong>{product.name}</strong>
                  <div className={styles.actions}>
                    {product.variants
                      .filter((v) => v.enabled)
                      .map((v) => (
                        <Button
                          type="button"
                          variant="secondary"
                          key={v.variantId}
                          disabled={h.lines.length >= 20}
                          onClick={() => h.add(product, v.variantId)}
                        >
                          Add {v.weightGrams} g · {v.price.toFixed(2)} BYN
                        </Button>
                      ))}
                  </div>
                </div>
              ))}
            {h.products.data?.items.length === 0 && <p>No published teas found.</p>}
            <CatalogPagination
              pagination={h.products.data?.pagination}
              onPage={h.products.setPage}
              disabled={h.products.loading}
            />
          </details>
          <p className={styles.muted}>
            The server calculates totals. Added items and changed quantities use current catalog
            prices. Stock is reserved only when the request is confirmed.
          </p>
          <Button type="submit" disabled={!h.lines.length || h.lines.length > 20}>
            {h.mutation.busy ? 'Saving…' : 'Save reservation'}
          </Button>
        </fieldset>
      </form>
    </EditorModal>
  )
}
