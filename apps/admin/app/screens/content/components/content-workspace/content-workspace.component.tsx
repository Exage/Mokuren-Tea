'use client'

import clsx from 'clsx'
import { Button } from '@mokuren/ui/button'
import { Input } from '@mokuren/ui/input'
import { Textarea } from '@mokuren/ui/textarea'
import { CatalogFeedback } from '@/app/shared/components/catalog-ui'
import { EditorModal } from '@/app/shared/components/editor-modal'
import { ReferencePicker } from '@/app/shared/components/reference-picker'
import type { CmsBlock } from '@/app/shared/api/types/cms'
import { contentBlocks, fieldsForBlock, hasImage } from './content-fields'
import { useContentEditorHook, useContentWorkspaceHook } from './content-workspace.hook'
import { ContentPreview } from '../content-preview'
import styles from './content-workspace.module.css'

function blockStatus(block?: CmsBlock) {
  if (!block?.draft && !block?.published) {
    return 'Empty'
  }
  return JSON.stringify(block.draft) === JSON.stringify(block.published) ? 'Published' : 'Draft'
}

export function ContentWorkspace() {
  const workspace = useContentWorkspaceHook()
  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <p>Store name, contact details, opening hours, and map location are managed in Settings.</p>
        <Button
          variant="ghost"
          disabled={workspace.mutation.busy || workspace.list.loading}
          onClick={workspace.refresh}
        >
          Refresh content
        </Button>
      </div>
      <CatalogFeedback
        loading={workspace.list.loading}
        error={workspace.list.error}
        notice={workspace.mutation.notice}
      />
      {workspace.list.error && (
        <Button variant="secondary" onClick={workspace.refresh}>
          Retry loading
        </Button>
      )}
      {!workspace.list.loading && workspace.list.data?.items.length === 0 && (
        <div className={styles.panel}>
          <h2>No content blocks yet</h2>
          <p>
            Run the backend content initialization command to create the website’s predefined
            blocks, then refresh this page.
          </p>
        </div>
      )}
      <div className={styles.layout}>
        <nav className={styles.navigation} aria-label="Website content blocks">
          {contentBlocks.map((item) => {
            const block = workspace.blocks.find((value) => value.blockKey === item.key)
            return (
              <button
                key={item.key}
                type="button"
                className={clsx(styles.block, workspace.selected === item.key && styles.selected)}
                aria-current={workspace.selected === item.key ? 'true' : undefined}
                disabled={!block || workspace.mutation.busy}
                onClick={() => workspace.select(item.key)}
              >
                <span className={styles.page}>{item.page}</span>
                <strong>{item.title}</strong>
                <span className={styles.status}>{blockStatus(block)}</span>
              </button>
            )
          })}
        </nav>
        {workspace.block ? (
          <ContentEditor
            key={`${workspace.block.blockKey}:${workspace.block.draftVersion}:${workspace.block.publishedVersion}:${workspace.editorVersion}`}
            block={workspace.block}
            workspace={workspace}
          />
        ) : (
          !workspace.list.loading &&
          !!workspace.blocks.length && <p>Select an available block to begin editing.</p>
        )}
      </div>
      {workspace.pending && (
        <EditorModal label="Discard unsaved changes" onClose={() => workspace.setPending(null)}>
          <div className={styles.stack}>
            <h2>Discard unsaved changes?</h2>
            <p>Your latest edits have not been saved to a draft.</p>
            <div className={styles.actions}>
              <Button onClick={workspace.discard}>Discard changes</Button>
              <Button variant="secondary" onClick={() => workspace.setPending(null)}>
                Keep editing
              </Button>
            </div>
          </div>
        </EditorModal>
      )}
    </div>
  )
}

function ContentEditor({
  block,
  workspace,
}: {
  block: CmsBlock
  workspace: ReturnType<typeof useContentWorkspaceHook>
}) {
  const editor = useContentEditorHook(
    block,
    workspace.saved,
    workspace.setDirty,
    workspace.mutation
  )
  const details = contentBlocks.find((item) => item.key === block.blockKey)
  const { content } = editor
  const busy = workspace.mutation.busy
  const saved = !!block.draft && !editor.dirty && !editor.conflict
  return (
    <div className={styles.stack}>
      <section className={styles.panel} aria-labelledby="content-title">
        <div className={styles.heading}>
          <div>
            <p className={styles.page}>
              {details?.page} / {blockStatus(block)}
            </p>
            <h2 id="content-title">{details?.title}</h2>
            <p className={styles.muted}>{details?.description}</p>
          </div>
          <span className={styles.badge}>
            {editor.dirty ? 'Unsaved changes' : `Draft v${block.draftVersion}`}
          </span>
        </div>
        <CatalogFeedback error={editor.conflict ? '' : workspace.mutation.error} />
        {editor.conflict && (
          <div role="alert" className={styles.warning}>
            This block changed in another session. Your edits are still here. Copy any text you
            need, then use “Refresh content” to load the latest version.
          </div>
        )}
        <form onSubmit={editor.save} className={styles.stack}>
          <fieldset disabled={busy} className={styles.fields}>
            {fieldsForBlock(block.blockKey).map((field) => (
              <label className={styles.field} key={field.key}>
                {field.label}
                {field.required ? ' *' : ''}
                {field.multiline ? (
                  <Textarea
                    rows={field.key === 'body' ? 10 : 3}
                    required={field.required}
                    maxLength={field.maxLength}
                    value={content[field.key] || ''}
                    onChange={(event) => editor.update({ [field.key]: event.target.value })}
                  />
                ) : (
                  <Input
                    type={field.type || 'text'}
                    required={field.required}
                    maxLength={field.maxLength}
                    pattern={
                      field.key.endsWith('Url')
                        ? '(/[^/].*|/|[hH][tT][tT][pP][sS]://.*)'
                        : undefined
                    }
                    title={
                      field.key.endsWith('Url') ? 'Use an internal path or HTTPS URL.' : undefined
                    }
                    value={content[field.key] || ''}
                    onChange={(event) => editor.update({ [field.key]: event.target.value })}
                  />
                )}
              </label>
            ))}
            {block.blockKey === 'home.hero' && (
              <p className={styles.muted}>
                Button links accept internal paths, such as /catalog, or HTTPS URLs.
              </p>
            )}
            {hasImage(block.blockKey) && (
              <ReferencePicker
                kind="media"
                label="Image"
                values={content.imageId ? [content.imageId] : []}
                disabled={busy}
                onChange={(ids) => editor.update({ imageId: ids[0] })}
              />
            )}
            {block.blockKey === 'home.featuredTeas' && (
              <>
                <ReferencePicker
                  kind="products"
                  label="Published teas"
                  values={content.teaIds || []}
                  multiple
                  maxSelected={4}
                  disabled={busy}
                  onChange={(teaIds) => editor.update({ teaIds })}
                />
                <p className={styles.muted}>
                  Select 1–4 published teas. Selection order is the display order.
                </p>
              </>
            )}
            {block.blockKey === 'home.testimonials' && (
              <div className={styles.stack}>
                {(content.testimonials || []).map((item, index) => (
                  <fieldset key={index} className={styles.testimonial}>
                    <legend>Testimonial {index + 1}</legend>
                    <label className={styles.field}>
                      Name *
                      <Input
                        required
                        maxLength={200}
                        value={item.name}
                        onChange={(event) =>
                          editor.update({
                            testimonials: content.testimonials?.map((value, i) =>
                              i === index ? { ...value, name: event.target.value } : value
                            ),
                          })
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      Quote *
                      <Textarea
                        required
                        maxLength={1000}
                        rows={3}
                        value={item.text}
                        onChange={(event) =>
                          editor.update({
                            testimonials: content.testimonials?.map((value, i) =>
                              i === index ? { ...value, text: event.target.value } : value
                            ),
                          })
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      Rating (optional, 1–5)
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        step={1}
                        value={item.rating ?? ''}
                        onChange={(event) =>
                          editor.update({
                            testimonials: content.testimonials?.map((value, i) =>
                              i === index
                                ? {
                                    name: value.name,
                                    text: value.text,
                                    ...(event.target.value
                                      ? { rating: Number(event.target.value) }
                                      : {}),
                                  }
                                : value
                            ),
                          })
                        }
                      />
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        editor.update({
                          testimonials: content.testimonials?.filter((_, i) => i !== index),
                        })
                      }
                    >
                      Remove testimonial
                    </Button>
                  </fieldset>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  disabled={(content.testimonials?.length || 0) >= 20}
                  onClick={() =>
                    editor.update({
                      testimonials: [...(content.testimonials || []), { name: '', text: '' }],
                    })
                  }
                >
                  Add testimonial
                </Button>
              </div>
            )}
          </fieldset>
          <div className={styles.savebar}>
            <span className={styles.muted}>
              {editor.dirty
                ? 'Save your edits before previewing or publishing.'
                : 'Drafts stay private until you publish.'}
            </span>
            <Button
              type="submit"
              disabled={busy || editor.conflict || (!editor.dirty && !!block.draft)}
            >
              {busy ? 'Working…' : 'Save draft'}
            </Button>
          </div>
        </form>
      </section>
      <section className={styles.panel} aria-label="Publishing">
        <div className={styles.heading}>
          <div>
            <h2>Ready to go live?</h2>
            <p className={styles.muted}>
              {block.published
                ? `Live version ${block.publishedVersion}. Publishing updates only this block.`
                : 'This block has not been published yet.'}
            </p>
          </div>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" disabled={busy || !saved} onClick={editor.showPreview}>
            Preview saved draft
          </Button>
          <Button
            disabled={busy || !saved || blockStatus(block) === 'Published'}
            onClick={() => editor.setConfirmation('publish')}
          >
            Publish block
          </Button>
        </div>
      </section>
      <section className={styles.panel} aria-labelledby="revision-title">
        <h2 id="revision-title">Publication history</h2>
        <p className={styles.muted}>
          Restore a past publication as a draft. The live website stays unchanged.
        </p>
        {!editor.history && <p role="status">Loading revisions…</p>}
        <CatalogFeedback error={editor.history?.error} />
        {editor.history?.error && (
          <Button variant="ghost" onClick={editor.retryHistory}>
            Retry history
          </Button>
        )}
        {editor.history && !editor.history.error && !editor.history.items.length && (
          <p className={styles.empty}>Your first publication will appear here.</p>
        )}
        {editor.history?.items.map((revision) => (
          <div className={styles.revision} key={revision.id}>
            <div>
              <strong>Version {revision.version}</strong>
              <p className={styles.muted}>
                {new Date(revision.publishedAt).toLocaleString('en-GB')}
              </p>
            </div>
            <Button
              variant="ghost"
              disabled={busy || editor.conflict}
              onClick={() => editor.setConfirmation(revision)}
            >
              Restore as draft
            </Button>
          </div>
        ))}
        {!!editor.history?.items.length && (
          <p className={styles.muted}>
            Showing the latest {editor.history.items.length} publications (up to 50).
          </p>
        )}
      </section>
      {editor.confirmation && (
        <EditorModal
          label={editor.confirmation === 'publish' ? 'Publish content' : 'Restore revision'}
          busy={busy}
          onClose={() => editor.setConfirmation(null)}
        >
          <div className={styles.stack}>
            <h2>
              {editor.confirmation === 'publish'
                ? 'Publish this block?'
                : `Restore version ${editor.confirmation.version}?`}
            </h2>
            <p>
              {editor.confirmation === 'publish'
                ? 'The saved draft will be visible on your website immediately.'
                : 'This replaces the current draft and any unsaved edits in this editor. The published version stays live.'}
            </p>
            <CatalogFeedback error={workspace.mutation.error} />
            <div className={styles.actions}>
              <Button disabled={busy} onClick={editor.confirm}>
                {busy ? 'Working…' : 'Confirm'}
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => editor.setConfirmation(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </EditorModal>
      )}
      {editor.preview && (
        <EditorModal label="Saved page preview" onClose={() => editor.setPreview(null)}>
          <div className={styles.stack}>
            <h2>Page content preview</h2>
            <p className={styles.muted}>
              The selected block uses its saved draft; other blocks use their published content.
              Storefront layout may differ.
            </p>
            <ContentPreview preview={editor.preview} selected={block.blockKey} />
          </div>
        </EditorModal>
      )}
    </div>
  )
}
