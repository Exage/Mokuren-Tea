import { PageHeading } from '@/app/shared/components/page-heading'
import { OverviewMetrics } from '@/app/screens/home/components/overview-metrics'
import { ReservationSummary } from '@/app/screens/home/components/reservation-summary'
import { QuickActions } from '@/app/screens/home/components/quick-actions'
import styles from './home.module.css'

export function HomeScreen() {
  return (
    <div>
      <PageHeading
        eyebrow="Store / Overview"
        title="Overview"
        description="Reservations, products, and inventory at a glance."
      />
      <OverviewMetrics />
      <div className={styles.columns}>
        <ReservationSummary />
        <QuickActions />
      </div>
    </div>
  )
}
