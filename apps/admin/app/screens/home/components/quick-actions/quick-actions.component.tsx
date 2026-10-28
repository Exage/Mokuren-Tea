import Link from 'next/link'
import { OverviewPanel } from '@/app/screens/home/components/overview-panel'
import styles from './quick-actions.module.css'

export function QuickActions() {
  return (
    <OverviewPanel title="Quick links" action={<span className={styles.hint}>Sections</span>}>
      <div className={styles.shortcuts}>
        <Link href="/products">
          <span>
            <strong>Products</strong>
            <small>Details, pack sizes, and prices</small>
          </span>
          <span aria-hidden="true">↗</span>
        </Link>
        <Link href="/inventory">
          <span>
            <strong>Inventory</strong>
            <small>Stock in grams and movements</small>
          </span>
          <span aria-hidden="true">↗</span>
        </Link>
        <Link href="/content">
          <span>
            <strong>Website content</strong>
            <small>Page copy and content blocks</small>
          </span>
          <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <div className={styles.stockNote}>
        <h3>Stock to watch</h3>
        <p>Low-stock and out-of-stock products will appear here once inventory is connected.</p>
        <Link href="/inventory">View inventory →</Link>
      </div>
    </OverviewPanel>
  )
}
