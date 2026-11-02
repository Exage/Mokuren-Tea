'use client'

import clsx from 'clsx'
import { Button } from '@mokuren/ui/button'
import { Input } from '@mokuren/ui/input'
import { CatalogFeedback, CatalogPagination } from '@/app/shared/components/catalog-ui'
import { EditorModal } from '@/app/shared/components/editor-modal'
import styles from '@/app/shared/components/catalog-ui/catalog-ui.module.css'
import { useAuditWorkspaceHook } from './audit-workspace.hook'
import workspaceStyles from './audit-workspace.module.css'

export function AuditWorkspace() {
  const state = useAuditWorkspaceHook()
  const { selected } = state

  return (
    <section className={clsx(styles.panel, styles.stack)} aria-label="Audit history">
      <form
        className={styles.stack}
        onSubmit={state.filter}
        onReset={state.clear}
        aria-label="Audit filters"
      >
        <div className={workspaceStyles.filters}>
          <label className={styles.field}>
            Administrator ID
            <Input name="actorId" maxLength={100} placeholder="Exact administrator ID" />
          </label>
          <label className={styles.field}>
            Action
            <Input name="action" maxLength={100} placeholder="e.g. admin-user.created" />
          </label>
          <label className={styles.field}>
            Resource type
            <Input name="entityType" maxLength={100} placeholder="e.g. admin-user" />
          </label>
          <label className={styles.field}>
            Resource ID
            <Input name="entityId" maxLength={100} placeholder="Exact resource ID" />
          </label>
          <label className={styles.field}>
            From
            <Input name="from" type="datetime-local" step="1" />
          </label>
          <label className={styles.field}>
            To
            <Input name="to" type="datetime-local" step="1" />
          </label>
        </div>
        <p className={styles.muted}>
          Text filters use exact values. Dates and times use your local time zone.
        </p>
        <div className={styles.actions}>
          <Button type="submit">Apply filters</Button>
          <Button type="reset" variant="secondary">
            Clear filters
          </Button>
          <Button type="button" variant="ghost" disabled={state.loading} onClick={state.refresh}>
            Refresh
          </Button>
        </div>
      </form>
      <CatalogFeedback error={state.error} loading={state.loading} />
      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className={styles.muted}>Administrative events, newest first</caption>
          <thead>
            <tr>
              <th scope="col">Date and time</th>
              <th scope="col">Administrator</th>
              <th scope="col">Action</th>
              <th scope="col">Resource</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>
            {state.data?.items.map((entry) => (
              <tr key={entry.id}>
                <td>{new Date(entry.createdAt).toLocaleString('en-GB')}</td>
                <td className={workspaceStyles.identifier}>{entry.actorId || 'System'}</td>
                <td>{entry.action}</td>
                <td>
                  <strong>{entry.entityType}</strong>
                  {entry.entityId && (
                    <p className={clsx(styles.muted, workspaceStyles.identifier)}>
                      {entry.entityId}
                    </p>
                  )}
                </td>
                <td>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => state.setSelected(entry)}
                    aria-label={`View ${entry.action} at ${new Date(entry.createdAt).toLocaleString('en-GB')}`}
                  >
                    View details
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {state.data?.items.length === 0 && (
        <p>No audit events found. Try clearing or adjusting the filters.</p>
      )}
      <CatalogPagination
        pagination={state.data?.pagination}
        onPage={state.setPage}
        disabled={state.loading}
      />
      {selected && (
        <EditorModal label="Audit event details" onClose={() => state.setSelected(null)}>
          <div className={styles.stack}>
            <h2>Event details</h2>
            <dl className={workspaceStyles.details}>
              <dt>Event ID</dt>
              <dd>{selected.id}</dd>
              <dt>Date and time</dt>
              <dd>{new Date(selected.createdAt).toLocaleString('en-GB')}</dd>
              <dt>Administrator ID</dt>
              <dd>{selected.actorId || 'System'}</dd>
              <dt>Action</dt>
              <dd>{selected.action}</dd>
              <dt>Resource type</dt>
              <dd>{selected.entityType}</dd>
              <dt>Resource ID</dt>
              <dd>{selected.entityId || '—'}</dd>
            </dl>
            <h3>Changes</h3>
            {selected.changes ? (
              <pre className={workspaceStyles.json}>
                {JSON.stringify(selected.changes, null, 2)}
              </pre>
            ) : (
              <p>No changes recorded.</p>
            )}
            <h3>Metadata</h3>
            {selected.metadata ? (
              <pre className={workspaceStyles.json}>
                {JSON.stringify(selected.metadata, null, 2)}
              </pre>
            ) : (
              <p>No metadata recorded.</p>
            )}
          </div>
        </EditorModal>
      )}
    </section>
  )
}
