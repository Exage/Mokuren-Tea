import type { Dashboard } from '@/app/shared/api/types/reservations'
import { reservationStatusLabel } from '@/app/shared/api/types/reservations'
import Link from 'next/link'
import { Button } from '@mokuren/ui/button'
import { OverviewPanel } from '@/app/screens/home/components/overview-panel'
import styles from './reservation-summary.module.css'

export function ReservationSummary({ items }: { items: Dashboard['recentReservations'] }) {
  return (
    <OverviewPanel
      title="Active reservations"
      action={<Link href="/reservations">All reservations ↗</Link>}
    >
      {items.length ? (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id}>
              <Link href={`/reservations?id=${encodeURIComponent(item.id)}`}>
                <strong>
                  {item.number} · {item.customerName}
                </strong>
                <span>
                  {reservationStatusLabel(item.status)} · {item.totalGrams} g
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>
          <h3>No active reservations</h3>
          <p>New, confirmed, and ready-for-pickup reservations appear here.</p>
          <Button href="/reservations" variant="secondary">
            View reservations
          </Button>
        </div>
      )}
    </OverviewPanel>
  )
}
