import Link from 'next/link'
import styles from './overview-metrics.module.css'

const metrics = [
  { label: 'New reservations', hint: 'Awaiting confirmation', href: '/reservations' },
  { label: 'Confirmed', hint: 'Stock reserved', href: '/reservations' },
  { label: 'Ready for pickup', hint: 'Awaiting collection', href: '/reservations' },
  { label: 'Low stock', hint: 'Below the stock threshold', href: '/inventory' },
  { label: 'Out of stock', hint: 'Restock needed', href: '/inventory' },
]

export function OverviewMetrics() {
  return (
    <section aria-label="Store metrics" className={styles.metrics}>
      {metrics.map((metric) => (
        <Link href={metric.href} className={styles.metric} key={metric.label}>
          <span className={styles.metricLabel}>{metric.label}</span>
          <strong className={styles.value} aria-label="Data not connected">
            —
          </strong>
          <span className={styles.hint}>{metric.hint}</span>
        </Link>
      ))}
    </section>
  )
}
