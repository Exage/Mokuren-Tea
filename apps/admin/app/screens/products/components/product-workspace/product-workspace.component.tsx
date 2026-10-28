'use client'
import clsx from 'clsx'
import { Button } from '@mokuren/ui/button'
import { Input } from '@mokuren/ui/input'
import { Checkbox } from '@mokuren/ui/checkbox'
import { Select } from '@mokuren/ui/select'
import { Textarea } from '@mokuren/ui/textarea'
import type { FormEvent } from 'react'
import type { useCatalogMutationHook } from '@/app/shared/hooks/catalog-data.hook'
import type { Product, Variant } from '@/app/shared/api/types/catalog'
import {
  CatalogFeedback,
  CatalogPagination,
  CatalogSearch,
} from '@/app/shared/components/catalog-ui'
import { ReferencePicker } from '@/app/shared/components/reference-picker'
import styles from '@/app/shared/components/catalog-ui/catalog-ui.module.css'
import { useProductEditorHook, useProductWorkspaceHook } from './product-workspace.hook'
import workspaceStyles from './product-workspace.module.css'

export function ProductWorkspace() {
  const state = useProductWorkspaceHook()
  const { list, mutation } = state
  return (
    <div className={styles.stack}>
      <CatalogFeedback error={mutation.error} notice={mutation.notice} />
      {state.discardTarget !== undefined && (
        <section className={clsx(styles.panel, styles.stack)} aria-label="Unsaved changes">
          <h2>Discard unsaved changes?</h2>
          <p>Save this product before opening another, or discard your changes.</p>
          <div className={styles.actions}>
            <Button type="button" onClick={state.confirmDiscard}>
              Discard changes
            </Button>
            <Button type="button" variant="ghost" onClick={() => state.setDiscardTarget(undefined)}>
              Keep editing
            </Button>
          </div>
        </section>
      )}
      <div className={styles.layout}>
        <section className={clsx(styles.panel, styles.stack)} aria-label="Product list">
          <div className={styles.actions}>
            <Button type="button" disabled={mutation.busy} onClick={() => state.select(null)}>
              New product
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={mutation.busy || list.loading}
              onClick={list.refresh}
            >
              Refresh
            </Button>
          </div>
          <CatalogSearch onSubmit={list.search} disabled={mutation.busy} />
          <div className={styles.field}>
            <label htmlFor="product-status">Status</label>
            <Select
              id="product-status"
              disabled={mutation.busy}
              value={state.status}
              onValueChange={state.changeStatus}
              options={[
                { value: '', label: 'All statuses' },
                { value: 'draft', label: 'Draft' },
                { value: 'published', label: 'Published' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
          </div>
          <CatalogFeedback error={list.error} loading={list.loading} />
          <div className={workspaceStyles.products}>
            {list.data?.items.map((product) => (
              <Button
                type="button"
                variant="ghost"
                className={workspaceStyles.product}
                key={product.id}
                aria-label={`Edit ${product.name}`}
                aria-pressed={product.id === state.selected?.id}
                disabled={mutation.busy}
                onClick={() => state.select(product)}
              >
                <span className={workspaceStyles.details}>
                  <strong>{product.name}</strong>
                  <span className={styles.muted}>
                    {product.status} · {product.variants.length} pack sizes ·{' '}
                    {product.stock.availableGrams} g available
                  </span>
                </span>
              </Button>
            ))}
          </div>
          {list.data?.items.length === 0 && (
            <p>No products found. Create a draft to start your collection.</p>
          )}
          <CatalogPagination
            pagination={list.data?.pagination}
            onPage={list.setPage}
            disabled={mutation.busy || list.loading}
          />
        </section>
        {state.selected !== undefined ? (
          <ProductEditor
            key={`${state.editorVersion}-${state.selected ? `${state.selected.id}-${state.selected.updatedAt}` : 'new'}`}
            mutation={mutation}
            product={state.selected}
            onSaved={state.saved}
            dirty={state.dirty}
            onDirty={state.setDirty}
          />
        ) : (
          <section className={styles.panel}>
            <h2>Your collection</h2>
            <p>Select a product to edit, or create a new draft.</p>
          </section>
        )}
      </div>
    </div>
  )
}

function ProductEditor({
  product,
  onSaved,
  dirty,
  onDirty,
  mutation,
}: {
  product: Product | null
  onSaved: (product: Product) => void
  dirty: boolean
  onDirty: (dirty: boolean) => void
  mutation: ReturnType<typeof useCatalogMutationHook>
}) {
  const state = useProductEditorHook(product, onSaved, onDirty, mutation)
  const { nameInputRef } = state
  const labels = Object.fromEntries(
    product?.images.map((image) => [image.id, image.alt || 'Product image']) || []
  )
  return (
    <section className={clsx(styles.panel, styles.stack)} aria-label="Product editor">
      <h2>{product ? product.name : 'New product'}</h2>
      {product?.status === 'published' && (
        <p className={styles.notice}>
          Changes to this published product appear in the store immediately after saving.
        </p>
      )}
      <form onSubmit={state.save} onChange={state.markFormDirty} className={styles.stack}>
        <fieldset className={styles.fields} disabled={mutation.busy}>
          <label className={styles.field}>
            Name
            <Input
              ref={nameInputRef}
              name="name"
              required
              maxLength={300}
              defaultValue={product?.name}
            />
          </label>
          <label className={styles.field}>
            Slug
            <Input
              name="slug"
              required
              maxLength={300}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              defaultValue={product?.slug}
              readOnly={!!product}
              placeholder="e.g. milk-oolong"
            />
          </label>
          {product && <p className={styles.muted}>The product URL is fixed after creation.</p>}
          <label className={styles.field}>
            Description
            <Textarea name="description" maxLength={5000} defaultValue={product?.description} />
          </label>
          <label className={styles.field}>
            Low stock threshold (g)
            <Input
              name="threshold"
              type="number"
              min={0}
              step={1}
              defaultValue={product?.lowStockThresholdGrams ?? 50}
              required
            />
          </label>
          <ReferencePicker
            kind="categories"
            label="Category"
            values={state.category}
            onChange={state.changeCategory}
            disabled={mutation.busy}
          />
          <ReferencePicker
            kind="taste-notes"
            label="Taste notes"
            multiple
            values={state.notes}
            onChange={state.changeNotes}
            disabled={mutation.busy}
          />
          <ReferencePicker
            kind="media"
            label="Images"
            multiple
            values={state.images}
            labels={labels}
            onChange={state.changeImages}
            disabled={mutation.busy}
          />
          {state.images.length > 0 && (
            <div className={styles.stack}>
              <p className={styles.muted}>Image order · The first image is the cover.</p>
              {state.images.map((id, index) => (
                <div className={styles.actions} key={id}>
                  <span>
                    {index + 1}. {labels[id] || id}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={index === 0}
                    onClick={() => state.moveImageEarlier(index)}
                  >
                    Move earlier
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => state.removeImage(id)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button type="submit">
            {mutation.busy ? 'Saving…' : product ? 'Save product' : 'Create draft'}
          </Button>
        </fieldset>
      </form>
      {product && (
        <>
          <h3>Pack sizes & prices</h3>
          {dirty && (
            <p className={styles.notice}>
              Save product details before changing pack sizes or publication status.
            </p>
          )}
          {product.variants.map((variant) => (
            <VariantForm
              key={variant.variantId}
              variant={variant}
              disabled={mutation.busy || dirty}
              onSubmit={(event) => state.variant(event, variant.variantId)}
            />
          ))}
          <VariantForm disabled={mutation.busy || dirty} onSubmit={state.variant} />
          <h3>Publication</h3>
          <p>
            Status: <strong>{product.status}</strong>
          </p>
          <p className={styles.muted}>
            Publishing requires a category, a ready image, and an enabled pack size with a price.
          </p>
          <div className={styles.actions}>
            {product.status === 'draft' && (
              <Button
                type="button"
                disabled={mutation.busy || dirty}
                onClick={() => state.setPendingStatus('publish')}
              >
                Publish
              </Button>
            )}
            {product.status !== 'archived' && (
              <Button
                type="button"
                variant="secondary"
                disabled={mutation.busy || dirty}
                onClick={() => state.setPendingStatus('archive')}
              >
                Archive
              </Button>
            )}
          </div>
          {state.pendingStatus && (
            <div className={styles.card}>
              <p>
                {state.pendingStatus === 'publish'
                  ? 'Publish this saved product to the store?'
                  : 'Archive this product and hide it from the catalog? Archived products cannot be published again.'}
              </p>
              <div className={styles.actions}>
                <Button type="button" disabled={mutation.busy || dirty} onClick={state.transition}>
                  Confirm {state.pendingStatus}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={mutation.busy}
                  onClick={() => state.setPendingStatus(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function VariantForm({
  variant,
  disabled,
  onSubmit,
}: {
  variant?: Variant
  disabled: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <form onSubmit={onSubmit}>
      <fieldset className={clsx(styles.fields, styles.card)} disabled={disabled}>
        <strong>{variant ? `Pack ${variant.weightGrams} g` : 'Add a pack size'}</strong>
        <div className={styles.actions}>
          <label className={styles.field}>
            Weight (g)
            <Input
              name="weight"
              type="number"
              min={1}
              step={1}
              defaultValue={variant?.weightGrams}
              required
            />
          </label>
          <label className={styles.field}>
            Price (BYN)
            <Input
              name="price"
              type="number"
              min={0.01}
              max={1000000}
              step={0.01}
              defaultValue={variant?.price}
              required
            />
          </label>
        </div>
        <label className={styles.check}>
          <Checkbox name="enabled" defaultChecked={variant ? variant.enabled : true} />
          Enabled
        </label>
        <Button type="submit" variant="secondary">
          {variant ? 'Save pack size' : 'Add pack size'}
        </Button>
      </fieldset>
    </form>
  )
}
