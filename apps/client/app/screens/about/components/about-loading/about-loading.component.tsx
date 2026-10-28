import { Container } from '@/app/shared/components/container'
import { Skeleton } from '@/app/shared/components/skeleton'
import screenStyles from '../../about.module.css'
import styles from './about-loading.module.css'

export function AboutLoading() {
  return (
    <main className={screenStyles.about} aria-busy="true">
      <Container>
        <div role="status" aria-label="Loading about page">
          <div className={screenStyles.story} aria-hidden="true">
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
            <Skeleton className={styles.image} />
          </div>
        </div>
      </Container>
    </main>
  )
}
