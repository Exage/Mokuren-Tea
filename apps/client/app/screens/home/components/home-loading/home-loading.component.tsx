import { Container } from '@/app/shared/components/container'
import { Skeleton } from '@/app/shared/components/skeleton'
import screenStyles from '../../home.module.css'
import styles from './home-loading.module.css'

export function HomeLoading() {
  return (
    <main className={screenStyles.home} aria-busy="true">
      <Container>
        <div role="status" aria-label="Loading home page">
          <div className={styles.hero} aria-hidden="true">
            <div className={styles.copy}>
              <Skeleton className={styles.eyebrow} />
              <Skeleton className={styles.title} />
              <Skeleton className={styles.text} />
              <Skeleton className={styles.text} />
              <div className={styles.actions}>
                <Skeleton className={styles.button} />
                <Skeleton className={styles.button} />
              </div>
            </div>
          </div>
          <div className={styles.review} aria-hidden="true">
            <Skeleton className={styles.title} />
            <Skeleton className={styles.text} />
          </div>
        </div>
      </Container>
    </main>
  )
}
