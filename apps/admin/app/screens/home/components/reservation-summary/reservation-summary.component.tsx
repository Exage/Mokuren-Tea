import Link from 'next/link'
import { Button } from '@mokuren/ui/button'
import { OverviewPanel } from '@/app/screens/home/components/overview-panel'
import styles from './reservation-summary.module.css'

export function ReservationSummary() {
  return (
    <OverviewPanel
      title="Active reservations"
      action={<Link href="/reservations">All reservations ↗</Link>}
    >
      <div className={styles.empty}>
        <h3>Reservations will appear here</h3>
        <p>New, confirmed, and ready-for-pickup reservations will be listed here.</p>
        <Button href="/reservations" variant="secondary">
          View reservations
        </Button>
      </div>
    </OverviewPanel>
  )
}
