import Link from 'next/link'
import { Container } from '@/app/shared/components/container'
import styles from './product-loading.module.css'

export function ProductLoading() {
  return (
    <main className={styles.loading}>
      <Container>
        <Link className={styles.back} href="/catalog">
          ← Back to catalog
        </Link>
        <div
          className={styles.layout}
          role="status"
          aria-label="Loading tea details"
          aria-busy="true"
        >
          <div className={styles.image} aria-hidden="true" />
          <div className={styles.details} aria-hidden="true">
            <div className={styles.category} />
            <div className={styles.title} />
            <div className={styles.description} />
            <div className={styles.controls} />
          </div>
        </div>
      </Container>
    </main>
  )
}
