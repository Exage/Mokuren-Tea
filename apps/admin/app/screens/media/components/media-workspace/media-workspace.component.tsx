'use client'
import { EditorModal } from '@/app/shared/components/editor-modal'
import clsx from 'clsx'
import Image from 'next/image'
import { Button } from '@mokuren/ui/button'
import { Input } from '@mokuren/ui/input'
import {
  CatalogFeedback,
  CatalogPagination,
  CatalogSearch,
} from '@/app/shared/components/catalog-ui'
import styles from '@/app/shared/components/catalog-ui/catalog-ui.module.css'
import { useMediaWorkspaceHook } from './media-workspace.hook'
import workspaceStyles from './media-workspace.module.css'

export function MediaWorkspace() {
  const state = useMediaWorkspaceHook()
  const { list, mutation, uploading, editing, deleting } = state
  return (
    <div className={styles.stack}>
      <CatalogFeedback
        error={uploading || editing ? undefined : mutation.error}
        notice={mutation.notice}
      />
      {uploading && (
        <EditorModal label="Upload image" busy={mutation.busy} onClose={state.closeEditor}>
          <CatalogFeedback floating error={mutation.error} />
          <section className={clsx(styles.panel, styles.stack)}>
            <h2>Upload image</h2>
            <p className={styles.muted}>JPG, PNG, or WebP · Maximum 10 MB</p>
            <form onSubmit={state.upload}>
              <fieldset className={styles.fields} disabled={mutation.busy}>
                <label className={styles.field}>
                  Image file
                  <Input
                    type="file"
                    name="file"
                    accept="image/jpeg,image/png,image/webp"
                    required
                  />
                </label>
                <label className={styles.field}>
                  Name (optional)
                  <Input name="name" maxLength={255} />
                </label>
                <label className={styles.field}>
                  Alternative text
                  <Input
                    name="alt"
                    maxLength={500}
                    placeholder="Describe the image for screen readers"
                  />
                </label>
                <div className={styles.actions}>
                  <Button type="submit">{mutation.busy ? 'Please wait…' : 'Upload image'}</Button>
                  <Button type="button" variant="ghost" onClick={state.closeEditor}>
                    Cancel
                  </Button>
                </div>
              </fieldset>
            </form>
          </section>
        </EditorModal>
      )}
      {editing && (
        <EditorModal
          label={`Edit ${editing.name}`}
          busy={mutation.busy}
          onClose={state.closeEditor}
        >
          <CatalogFeedback floating error={mutation.error} />
          <section className={clsx(styles.panel, styles.stack)}>
            <h2>Edit {editing.name}</h2>
            {editing.url && (
              <Image
                unoptimized
                className={styles.image}
                src={editing.url}
                alt={editing.alt || ''}
                width={240}
                height={160}
              />
            )}
            <form onSubmit={state.save} key={editing.id}>
              <fieldset className={styles.fields} disabled={mutation.busy}>
                <label className={styles.field}>
                  Replace image (optional)
                  <Input type="file" name="file" accept="image/jpeg,image/png,image/webp" />
                </label>
                <p className={styles.muted}>
                  JPG, PNG, or WebP · Maximum 10 MB. Replacing this image updates every product and
                  website section that uses it, including published content.
                </p>
                <label className={styles.field}>
                  Name
                  <Input name="name" defaultValue={editing.name} maxLength={255} required />
                </label>
                <label className={styles.field}>
                  Alternative text
                  <Input name="alt" defaultValue={editing.alt} maxLength={500} />
                </label>
                <div className={styles.actions}>
                  <Button type="submit">Save details</Button>
                  <Button type="button" variant="ghost" onClick={state.closeEditor}>
                    Cancel
                  </Button>
                </div>
              </fieldset>
            </form>
          </section>
        </EditorModal>
      )}
      {deleting && (
        <section className={clsx(styles.panel, styles.stack)} aria-label="Confirm image deletion">
          <h2>Delete {deleting.name}?</h2>
          {state.usages === null ? (
            <p>Checking product usage…</p>
          ) : state.usages.length ? (
            <>
              <p>Remove this image from these products before deleting it:</p>
              <ul>
                {state.usages.map((item) => (
                  <li key={item.id}>
                    {item.name} ({item.status})
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>
              No products use this image. Deleting it removes the file permanently. The server also
              checks for website content references.
            </p>
          )}
          <div className={styles.actions}>
            <Button
              type="button"
              disabled={mutation.busy || state.usages === null || !!state.usages.length}
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
      <section className={clsx(styles.panel, styles.stack)} aria-label="Media library">
        <div className={styles.actions}>
          <Button type="button" disabled={mutation.busy} onClick={state.openUpload}>
            Upload image
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
        <CatalogFeedback error={list.error} loading={list.loading} />
        <div className={styles.grid}>
          {list.data?.items.map((asset) => (
            <article className={clsx(styles.card, workspaceStyles.card)} key={asset.id}>
              {asset.url && (
                <Image
                  unoptimized
                  className={styles.image}
                  src={asset.url}
                  alt={asset.alt || ''}
                  width={240}
                  height={160}
                />
              )}
              <Button
                type="button"
                variant="ghost"
                className={workspaceStyles.edit}
                aria-label={`Edit ${asset.name}`}
                disabled={mutation.busy}
                onClick={() => state.edit(asset)}
              >
                <strong>{asset.name}</strong>
              </Button>
              <p className={styles.muted}>
                {asset.width} × {asset.height} · {asset.usageCount} uses
              </p>
              <p>{asset.alt || 'No alternative text'}</p>
              <div className={styles.actions}>
                <Button
                  type="button"
                  variant="ghost"
                  className={workspaceStyles.delete}
                  aria-label={`Delete ${asset.name}`}
                  disabled={mutation.busy}
                  onClick={() => state.prepareDelete(asset)}
                >
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
        {list.data?.items.length === 0 && (
          <p>No images found. Upload an image to start your library.</p>
        )}
        <CatalogPagination
          pagination={list.data?.pagination}
          onPage={list.setPage}
          disabled={mutation.busy || list.loading}
        />
      </section>
    </div>
  )
}
