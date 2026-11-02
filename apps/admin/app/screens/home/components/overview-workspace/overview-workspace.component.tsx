'use client'
import Link from 'next/link'
import { Button } from '@mokuren/ui/button'
import { CatalogFeedback } from '@/app/shared/components/catalog-ui'
import { OverviewMetrics } from '../overview-metrics'
import { ReservationSummary } from '../reservation-summary'
import { QuickActions } from '../quick-actions'
import { OverviewPanel } from '../overview-panel'
import { useOverviewWorkspaceHook } from './overview-workspace.hook'
import styles from './overview-workspace.module.css'

export function OverviewWorkspace() {
  const h = useOverviewWorkspaceHook()
  return (
    <div className={styles.stack}>
      <div>
        <Button type="button" variant="secondary" disabled={h.loading} onClick={h.refresh}>
          Refresh overview
        </Button>
      </div>
      <CatalogFeedback loading={h.loading} error={h.error} />
      {h.data && (
        <>
          <OverviewMetrics data={h.data} />
          <div className={styles.columns}>
            <ReservationSummary items={h.data.recentReservations} />
            <QuickActions />
          </div>
          <OverviewPanel
            title="Stock requiring attention"
            action={<Link href="/inventory">View inventory ↗</Link>}
          >
            {h.data.stock.problematicProducts.length ? (
              <ul className={styles.stock}>
                {h.data.stock.problematicProducts.map((p) => (
                  <li key={p.productId}>
                    <strong>{p.productName}</strong>
                    <span>
                      {p.availableGrams} g available ·{' '}
                      {p.issue === 'out-of-stock' ? 'Out of stock' : 'Low stock'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>No stock issues.</p>
            )}
          </OverviewPanel>
        </>
      )}
    </div>
  )
}
