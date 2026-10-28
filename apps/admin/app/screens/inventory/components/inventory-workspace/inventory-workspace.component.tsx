'use client'
import clsx from 'clsx'
import { Button } from '@mokuren/ui/button'
import { Input } from '@mokuren/ui/input'
import { Textarea } from '@mokuren/ui/textarea'
import { Select } from '@mokuren/ui/select'
import {
  CatalogFeedback,
  CatalogPagination,
  CatalogSearch,
} from '@/app/shared/components/catalog-ui'
import type { StockOperation } from '@/app/shared/api/types/catalog'
import styles from '@/app/shared/components/catalog-ui/catalog-ui.module.css'
import { useInventoryWorkspaceHook } from './inventory-workspace.hook'
import workspaceStyles from './inventory-workspace.module.css'

export function InventoryWorkspace() {
  const state = useInventoryWorkspaceHook()
  const {
    products,
    selected,
    mutation,
    pending,
    reviewHeadingRef,
    operationFormRef,
    stockHeadingRef,
  } = state
  const locked = mutation.busy || !!pending
  return (
    <div className={styles.stack}>
      <div className={styles.layout}>
        <section className={clsx(styles.panel, styles.stack)} aria-label="Inventory products">
          <h2>Product stock</h2>
          <CatalogSearch onSubmit={products.search} disabled={locked} />
          <Button
            type="button"
            variant="ghost"
            disabled={locked || products.loading}
            onClick={products.refresh}
          >
            Refresh products
          </Button>
          <CatalogFeedback error={products.error} loading={products.loading} />
          <div className={workspaceStyles.products}>
            {products.data?.items.map((product) => (
              <Button
                type="button"
                variant="ghost"
                className={workspaceStyles.product}
                key={product.id}
                aria-label={`Manage stock for ${product.name}`}
                aria-pressed={selected?.id === product.id}
                disabled={locked}
                onClick={() => state.select(product)}
              >
                <span className={workspaceStyles.details}>
                  <strong>{product.name}</strong>
                  <span className={styles.muted}>
                    {product.stock.physicalGrams} g physical · {product.stock.reservedGrams} g
                    reserved · {product.stock.availableGrams} g available
                  </span>
                  {product.stock.availableGrams <= product.lowStockThresholdGrams && (
                    <span className={styles.danger}>
                      {product.stock.availableGrams === 0 ? 'Out of stock' : 'Low stock'}
                    </span>
                  )}
                </span>
              </Button>
            ))}
          </div>
          {products.data?.items.length === 0 && (
            <p>No products found. Create a product before recording stock.</p>
          )}
          <CatalogPagination
            pagination={products.data?.pagination}
            onPage={products.setPage}
            disabled={locked || products.loading}
          />
        </section>
        <section className={clsx(styles.panel, styles.stack)} aria-label="Stock operations">
          <h2 ref={stockHeadingRef} tabIndex={-1}>
            {selected?.name || 'Select a product'}
          </h2>
          <CatalogFeedback error={mutation.error} notice={mutation.notice} />
          {pending && (
            <section className={styles.stack} aria-label="Confirm stock change">
              <h3 ref={reviewHeadingRef} tabIndex={-1}>
                Confirm stock change
              </h3>
              <p>
                {selected?.name} ·{' '}
                {pending.operation === 'adjust'
                  ? `Set physical stock to ${pending.grams} g`
                  : pending.operation === 'compensate'
                    ? 'Reverse the selected movement'
                    : `${pending.operation}: ${pending.grams} g`}
              </p>
              <p>Reason: {pending.reason}</p>
              <p className={styles.muted}>
                The server checks the latest stock before applying this change.
              </p>
              <div className={styles.actions}>
                <Button type="button" disabled={mutation.busy} onClick={state.confirm}>
                  {mutation.busy ? 'Saving…' : 'Confirm stock change'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={mutation.busy}
                  onClick={() => state.setPending(null)}
                >
                  Back to editing
                </Button>
              </div>
            </section>
          )}
          <div hidden={!!pending}>
            <div className={styles.stack}>
              {selected ? (
                <>
                  <div className={styles.actions}>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={locked || state.loading}
                      onClick={state.refresh}
                    >
                      Refresh stock & history
                    </Button>
                    <Button href="/products" variant="ghost">
                      Edit product thresholds
                    </Button>
                  </div>
                  <CatalogFeedback error={state.error} loading={state.loading} />
                  {state.stock && (
                    <>
                      <div className={styles.grid}>
                        <div className={styles.card}>
                          Physical<strong>{state.stock.physicalGrams} g</strong>
                        </div>
                        <div className={styles.card}>
                          Reserved<strong>{state.stock.reservedGrams} g</strong>
                        </div>
                        <div className={styles.card}>
                          Available<strong>{state.stock.availableGrams} g</strong>
                        </div>
                      </div>
                      <p className={styles.muted}>
                        Reserved stock is controlled by reservations. All changes require a reason
                        and are recorded in history.
                      </p>
                      <form
                        ref={operationFormRef}
                        key={`${selected.id}-${state.correction?.id || 'stock'}`}
                        onSubmit={state.prepare}
                      >
                        <fieldset className={styles.fields} disabled={locked || state.loading}>
                          {state.correction ? (
                            <>
                              <h3>Compensate movement</h3>
                              <p>
                                {state.correction.type} · {state.correction.delta.physicalGrams} g
                                physical change · {state.correction.reason}
                              </p>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => state.setCorrection(null)}
                              >
                                Cancel correction
                              </Button>
                            </>
                          ) : (
                            <>
                              <div className={styles.field}>
                                <label htmlFor="stock-operation">Operation</label>
                                <Select<StockOperation>
                                  id="stock-operation"
                                  disabled={locked || state.loading}
                                  value={state.operation}
                                  onValueChange={state.setOperation}
                                  options={[
                                    { value: 'receipt', label: 'Stock receipt' },
                                    { value: 'write-off', label: 'Write-off' },
                                    { value: 'adjust', label: 'Stock count / adjustment' },
                                  ]}
                                />
                              </div>
                              <label className={styles.field}>
                                {state.operation === 'adjust'
                                  ? 'Counted physical stock (g)'
                                  : 'Quantity (g)'}
                                <Input
                                  name="grams"
                                  type="number"
                                  min={state.operation === 'adjust' ? 0 : 1}
                                  step={1}
                                  required
                                />
                              </label>
                            </>
                          )}
                          <label className={styles.field}>
                            Reason
                            <Textarea name="reason" required maxLength={500} />
                          </label>
                          <Button type="submit">Review change</Button>
                        </fieldset>
                      </form>
                    </>
                  )}
                </>
              ) : (
                <p>Choose a product to record a receipt, write-off, stock count, or correction.</p>
              )}
            </div>
          </div>
        </section>
      </div>
      {selected && (
        <section className={clsx(styles.panel, styles.stack)}>
          <h2>Movement history · {selected.name}</h2>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Type</th>
                  <th scope="col">Physical change</th>
                  <th scope="col">Reserved change</th>
                  <th scope="col">Physical after</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Correction</th>
                </tr>
              </thead>
              <tbody>
                {state.history?.items.map((movement) => (
                  <tr key={movement.id}>
                    <td>{new Date(movement.createdAt).toLocaleString('en-GB')}</td>
                    <td>{movement.type}</td>
                    <td>{movement.delta.physicalGrams} g</td>
                    <td>{movement.delta.reservedGrams} g</td>
                    <td>{movement.after.physicalGrams} g</td>
                    <td>{movement.reason || '—'}</td>
                    <td>
                      {['receipt', 'write-off', 'adjustment'].includes(movement.type) && (
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={locked}
                          onClick={() => state.setCorrection(movement)}
                        >
                          Compensate
                        </Button>
                      )}
                      {movement.correctionOfId && 'Compensation recorded'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {state.history?.items.length === 0 && <p>No stock movements yet.</p>}
          <CatalogPagination
            pagination={state.history?.pagination}
            onPage={state.setPage}
            disabled={locked || state.loading}
          />
        </section>
      )}
    </div>
  )
}
