'use client'
import clsx from 'clsx'
import { Button } from '@mokuren/ui/button'
import { Input } from '@mokuren/ui/input'
import type { DictionaryKind } from '../../api/types/catalog'
import { CatalogFeedback, CatalogPagination, CatalogSearch } from '../catalog-ui'
import { ReferencePicker } from '../reference-picker'
import { useDictionaryEditorHook } from './dictionary-editor.hook'
import styles from '../catalog-ui/catalog-ui.module.css'
import editorStyles from './dictionary-editor.module.css'

export function DictionaryEditor({ kind }: { kind: DictionaryKind }) {
  const state = useDictionaryEditorHook(kind)
  const { list, mutation, editing, deleting, nameInputRef, deleteHeadingRef } = state
  const singular = kind === 'categories' ? 'category' : 'taste note'
  return (
    <div className={styles.stack}>
      <CatalogFeedback error={mutation.error} notice={mutation.notice} />
      <div className={styles.layout}>
        <section className={clsx(styles.panel, styles.stack)} aria-label={`${kind} list`}>
          <CatalogSearch onSubmit={list.search} disabled={mutation.busy} />
          <CatalogFeedback loading={list.loading} error={list.error} />
          <Button
            type="button"
            variant="ghost"
            onClick={list.refresh}
            disabled={mutation.busy || list.loading}
          >
            Refresh
          </Button>
          <div>
            {list.data?.items.map((item) => (
              <div
                key={item.id}
                className={clsx(
                  styles.row,
                  editorStyles.entry,
                  editing?.id === item.id && styles.selected
                )}
              >
                <Button
                  type="button"
                  variant="ghost"
                  className={editorStyles.edit}
                  aria-label={`Edit ${item.name}`}
                  aria-pressed={editing?.id === item.id}
                  disabled={mutation.busy}
                  onClick={() => state.edit(item)}
                >
                  <span className={editorStyles.details}>
                    <strong>{item.name}</strong>
                    <span className={styles.muted}>
                      {item.slug} · Order {item.sortOrder} · {item.productsCount} products
                    </span>
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className={editorStyles.delete}
                  aria-label={`Delete ${item.name}`}
                  disabled={mutation.busy}
                  onClick={() => state.prepareDelete(item)}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
          {list.data?.items.length === 0 && (
            <p>
              No {kind === 'categories' ? 'categories' : 'taste notes'} found. Create your first
              one.
            </p>
          )}
          <CatalogPagination
            pagination={list.data?.pagination}
            onPage={list.setPage}
            disabled={mutation.busy || list.loading}
          />
        </section>
        <div className={styles.stack}>
          {deleting && (
            <section
              role="region"
              aria-label="Confirm deletion"
              className={clsx(styles.panel, styles.stack)}
            >
              <h2 ref={deleteHeadingRef} tabIndex={-1}>
                Delete {deleting.name}?
              </h2>
              <p>
                {state.usageCount === null
                  ? 'Checking product usage…'
                  : `${state.usageCount} products use this ${singular}.`}
              </p>
              {kind === 'categories' && !!state.usageCount ? (
                <>
                  <p>Choose a destination category for the linked products before deleting.</p>
                  <ReferencePicker
                    key={deleting.id}
                    kind="categories"
                    label="Destination category"
                    values={state.target}
                    onChange={state.setTarget}
                    exclude={deleting.id}
                    disabled={mutation.busy}
                  />
                </>
              ) : kind === 'categories' ? (
                <p>This category has no products and can be deleted.</p>
              ) : (
                <p>
                  This taste note will be removed from every linked product, including published
                  products.
                </p>
              )}
              <div className={styles.actions}>
                <Button
                  type="button"
                  disabled={
                    mutation.busy ||
                    state.usageCount === null ||
                    (kind === 'categories' && !!state.usageCount && !state.target.length)
                  }
                  onClick={state.remove}
                >
                  Confirm deletion
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={mutation.busy}
                  onClick={() => state.setDeleting(null)}
                >
                  Cancel
                </Button>
              </div>
            </section>
          )}
          <div hidden={!!deleting}>
            <section className={clsx(styles.panel, styles.stack)}>
              <h2>{editing ? `Edit ${singular}` : `New ${singular}`}</h2>
              <form
                key={`${editing?.id || 'new'}-${state.formVersion}`}
                onSubmit={state.save}
                className={styles.stack}
              >
                <fieldset disabled={mutation.busy} className={styles.fields}>
                  <label className={styles.field}>
                    Name
                    <Input
                      ref={nameInputRef}
                      name="name"
                      defaultValue={editing?.name}
                      required
                      maxLength={300}
                    />
                  </label>
                  <label className={styles.field}>
                    Slug
                    <Input
                      name="slug"
                      defaultValue={editing?.slug}
                      required
                      maxLength={300}
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      placeholder="e.g. floral"
                    />
                  </label>
                  <label className={styles.field}>
                    Display order
                    <Input
                      name="sortOrder"
                      type="number"
                      min={0}
                      step={1}
                      defaultValue={editing?.sortOrder || 0}
                      required
                    />
                  </label>
                  <div className={styles.actions}>
                    <Button type="submit">{mutation.busy ? 'Saving…' : 'Save'}</Button>
                    {editing && (
                      <Button type="button" variant="ghost" onClick={() => state.setEditing(null)}>
                        Cancel edit
                      </Button>
                    )}
                  </div>
                </fieldset>
              </form>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
