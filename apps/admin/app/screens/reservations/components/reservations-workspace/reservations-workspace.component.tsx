'use client'
import clsx from 'clsx'
import { Button } from '@mokuren/ui/button'
import { Input } from '@mokuren/ui/input'
import { Select } from '@mokuren/ui/select'
import { Checkbox } from '@mokuren/ui/checkbox'
import { PageHeading } from '@/app/shared/components/page-heading'
import { CatalogFeedback, CatalogPagination } from '@/app/shared/components/catalog-ui'
import { EditorModal } from '@/app/shared/components/editor-modal'
import { reservationStatuses, reservationStatusLabel } from '@/app/shared/api/types/reservations'
import { ReservationEditor } from '../reservation-editor'
import { useReservationsWorkspaceHook } from './reservations-workspace.hook'
import styles from '@/app/shared/components/catalog-ui/catalog-ui.module.css'
import local from './reservations-workspace.module.css'

const actionLabels = {
  confirm: 'Confirm reservation',
  ready: 'Mark ready for pickup',
  complete: 'Complete pickup',
  cancel: 'Cancel reservation',
}
export function ReservationsWorkspace() {
  const h = useReservationsWorkspaceHook()
  const r = h.selected
  return (
    <div className={styles.stack}>
      <PageHeading
        eyebrow="Store"
        title="Reservations"
        description="Manage pickup reservations from request to collection."
      />
      <div className={styles.actions}>
        <Button type="button" onClick={() => h.setEditor('create')}>
          Create reservation
        </Button>
        <Button type="button" variant="secondary" disabled={h.loading} onClick={h.refresh}>
          Refresh
        </Button>
      </div>
      <form className={styles.panel} onSubmit={h.filter}>
        <div className={local.filters}>
          <label className={styles.field}>
            Status
            <Select
              value={h.query.status || ''}
              options={[{ value: '', label: 'All statuses' }, ...reservationStatuses]}
              onValueChange={(status) => h.setQuery((value) => ({ ...value, status, page: 1 }))}
            />
          </label>
          <label className={styles.field}>
            Source
            <Select
              value={h.query.source || ''}
              options={[
                { value: '', label: 'All sources' },
                { value: 'website', label: 'Website' },
                { value: 'admin', label: 'Admin' },
              ]}
              onValueChange={(source) => h.setQuery((value) => ({ ...value, source, page: 1 }))}
            />
          </label>
          <label className={styles.field}>
            Customer name
            <Input name="customerName" maxLength={200} />
          </label>
          <label className={styles.field}>
            Phone
            <Input name="customerPhone" maxLength={50} type="tel" />
          </label>
          <label className={styles.field}>
            Created from
            <Input name="from" type="datetime-local" />
          </label>
          <label className={styles.field}>
            Created to
            <Input name="to" type="datetime-local" />
          </label>
        </div>
        <Button type="submit" variant="secondary">
          Apply filters
        </Button>
      </form>
      <CatalogFeedback loading={h.loading} error={h.error} notice={h.mutation.notice} />
      <div className={styles.panel}>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Reservation</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Source</th>
                <th>Total</th>
                <th>Created</th>
                <th>
                  <span className={styles.muted}>Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {h.data?.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.number}</td>
                  <td>
                    {item.customerName}
                    <br />
                    {item.customerPhone}
                  </td>
                  <td>{reservationStatusLabel(item.status)}</td>
                  <td>{item.source === 'admin' ? 'Admin' : 'Website'}</td>
                  <td>
                    {item.totalAmount.toFixed(2)} BYN
                    <br />
                    {item.totalGrams} g
                  </td>
                  <td>{new Date(item.createdAt).toLocaleString('en-GB')}</td>
                  <td>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`View ${item.number}`}
                      onClick={() => h.select(item.id)}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {h.data?.items.length === 0 && <p>No reservations match these filters.</p>}
        <CatalogPagination
          pagination={h.data?.pagination}
          onPage={h.setPage}
          disabled={h.loading}
        />
      </div>
      {h.id && !h.editor && (
        <EditorModal
          label={r?.number || 'Reservation details'}
          onClose={() => h.select(null)}
          busy={h.mutation.busy}
        >
          <div className={clsx(styles.stack, local.detail)}>
            <CatalogFeedback loading={h.detailLoading} error={h.detailError || h.mutation.error} />
            {(h.detailError || h.mutation.error) && (
              <Button
                type="button"
                variant="secondary"
                disabled={h.mutation.busy}
                onClick={h.refresh}
              >
                Refresh reservation
              </Button>
            )}
            {r && (
              <>
                <h2>
                  {r.number} · {reservationStatusLabel(r.status)}
                </h2>
                <p>
                  {r.customerName} · <a href={`tel:${r.customerPhone}`}>{r.customerPhone}</a>
                </p>
                <p className={styles.muted}>
                  {r.source === 'admin' ? 'Admin' : 'Website'} · Created{' '}
                  {new Date(r.createdAt).toLocaleString('en-GB')}
                </p>
                {r.lines.map((line, index) => (
                  <div className={styles.card} key={index}>
                    <strong>{line.productName}</strong>
                    <p>
                      {line.quantity} × {line.variantWeightGrams} g · {line.variantPrice.toFixed(2)}{' '}
                      BYN per pack
                    </p>
                    <p>
                      {line.lineTotal.toFixed(2)} BYN · {line.grams} g
                    </p>
                  </div>
                ))}
                <strong>
                  Total: {r.totalAmount.toFixed(2)} BYN · {r.totalGrams} g
                </strong>
                {!h.pending && (
                  <div className={styles.actions}>
                    {r.status === 'new' && (
                      <>
                        <Button type="button" variant="secondary" onClick={() => h.setEditor(r)}>
                          Edit request
                        </Button>
                        <Button type="button" onClick={() => h.prepare('confirm')}>
                          {actionLabels.confirm}
                        </Button>
                      </>
                    )}
                    {r.status === 'confirmed' && (
                      <Button type="button" onClick={() => h.prepare('ready')}>
                        {actionLabels.ready}
                      </Button>
                    )}
                    {r.status === 'ready' && (
                      <Button type="button" onClick={() => h.prepare('complete')}>
                        {actionLabels.complete}
                      </Button>
                    )}
                    {['new', 'confirmed', 'ready'].includes(r.status) && (
                      <Button type="button" variant="ghost" onClick={() => h.prepare('cancel')}>
                        {actionLabels.cancel}
                      </Button>
                    )}
                  </div>
                )}
                {h.pending && (
                  <section className={styles.card} aria-label="Review status change">
                    <h3>{actionLabels[h.pending]}?</h3>
                    <p>
                      {h.pending === 'confirm'
                        ? 'This reserves stock for all items.'
                        : h.pending === 'complete'
                          ? 'Confirm that the customer collected the tea. This writes off the reserved stock.'
                          : h.pending === 'cancel'
                            ? 'This cancels the request and releases any reserved stock.'
                            : 'Confirm that the tea is packed and ready for collection.'}
                    </p>
                    {h.pending === 'cancel' && r.status === 'ready' && (
                      <label className={styles.check}>
                        <Checkbox
                          checked={h.teaReturned}
                          disabled={h.mutation.busy}
                          onChange={(event) => h.setTeaReturned(event.target.checked)}
                        />
                        The tea has been returned to stock.
                      </label>
                    )}
                    <div className={styles.actions}>
                      <Button
                        type="button"
                        disabled={
                          h.mutation.busy ||
                          (h.pending === 'cancel' && r.status === 'ready' && !h.teaReturned)
                        }
                        onClick={h.confirm}
                      >
                        {h.mutation.busy ? 'Updating…' : actionLabels[h.pending]}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={h.mutation.busy}
                        onClick={() => h.setPending(null)}
                      >
                        Go back
                      </Button>
                    </div>
                  </section>
                )}
                <h3>Reservation history</h3>
                {h.events.map((event) => (
                  <div className={styles.card} key={event.id}>
                    <strong>
                      {event.action === 'status-changed'
                        ? `${reservationStatusLabel(event.oldStatus || '')} → ${reservationStatusLabel(event.newStatus || '')}`
                        : event.action === 'created'
                          ? 'Created'
                          : 'Edited'}
                    </strong>
                    <p className={styles.muted}>
                      {new Date(event.createdAt).toLocaleString('en-GB')} ·{' '}
                      {event.actorId ? `Admin ${event.actorId}` : 'Website'}
                    </p>
                    {event.changes && (
                      <details>
                        <summary>Changes</summary>
                        <pre className={local.json}>{JSON.stringify(event.changes, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                ))}
                {!h.events.length && <p>No history recorded.</p>}
              </>
            )}
          </div>
        </EditorModal>
      )}
      {h.editor && (
        <ReservationEditor
          reservation={h.editor === 'create' ? null : h.editor}
          onSaved={h.saved}
          onClose={() => h.setEditor(null)}
        />
      )}
    </div>
  )
}
