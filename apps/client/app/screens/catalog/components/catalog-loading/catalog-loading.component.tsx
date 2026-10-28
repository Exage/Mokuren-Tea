import { Container } from '@/app/shared/components/container'
import { Skeleton } from '@/app/shared/components/skeleton'
import screenStyles from '../../catalog.module.css'
import resultsStyles from '../catalog-results/catalog-results.module.css'
import styles from './catalog-loading.module.css'

export function CatalogLoading() {
  return (
    <main className={screenStyles.catalog} aria-busy="true">
      <Container>
        <div role="status" aria-label="Loading catalog page">
          <div className={screenStyles.heading} aria-hidden="true">
            <div className={styles.copy}>
              <Skeleton className={styles.eyebrow} />
              <Skeleton className={styles.title} />
              <Skeleton className={styles.text} />
            </div>
          </div>
          <div className={styles.categories} aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className={styles.category} />
            ))}
          </div>
          <div className={styles.toolbar} aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className={styles.button} />
            ))}
          </div>
          <div className={resultsStyles.grid} aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className={styles.card} />
            ))}
          </div>
        </div>
      </Container>
    </main>
  )
}
