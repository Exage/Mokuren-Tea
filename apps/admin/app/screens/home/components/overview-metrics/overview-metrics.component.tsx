import type { Dashboard } from '@/app/shared/api/types/reservations'
import Link from 'next/link'
import styles from './overview-metrics.module.css'

const metrics = [
  {
    label: 'New reservations',
    hint: 'Awaiting confirmation',
    href: '/reservations?status=new',
    value: (data: Dashboard) => data.reservations.new,
  },
  {
    label: 'Confirmed',
    hint: 'Stock reserved',
    href: '/reservations?status=confirmed',
    value: (data: Dashboard) => data.reservations.confirmed,
  },
  {
    label: 'Ready for pickup',
    hint: 'Awaiting collection',
    href: '/reservations?status=ready',
    value: (data: Dashboard) => data.reservations.ready,
  },
  {
    label: 'Low stock',
    hint: 'Below the stock threshold',
    href: '/inventory',
    value: (data: Dashboard) => data.stock.lowStockProducts,
  },
  {
    label: 'Out of stock',
    hint: 'Restock needed',
    href: '/inventory',
    value: (data: Dashboard) => data.stock.outOfStockProducts,
  },
]

export function OverviewMetrics({ data }: { data: Dashboard }) {
  return (
    <section aria-label="Store metrics" className={styles.metrics}>
      {metrics.map((metric) => (
        <Link href={metric.href} className={styles.metric} key={metric.label}>
          <span className={styles.metricLabel}>{metric.label}</span>
          <strong className={styles.value}>{metric.value(data)}</strong>
          <span className={styles.hint}>{metric.hint}</span>
        </Link>
      ))}
    </section>
  )
}
