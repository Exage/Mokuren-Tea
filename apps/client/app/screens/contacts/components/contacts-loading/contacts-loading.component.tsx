import { Container } from '@/app/shared/components/container'
import { Skeleton } from '@/app/shared/components/skeleton'
import screenStyles from '../../contacts.module.css'
import styles from './contacts-loading.module.css'

export function ContactsLoading() {
  return (
    <main className={screenStyles.contacts} aria-busy="true">
      <Container>
        <div role="status" aria-label="Loading contacts page">
          <div className={styles.copy} aria-hidden="true">
            <Skeleton className={styles.eyebrow} />
            <Skeleton className={styles.title} />
          </div>
          <div className={screenStyles.content} aria-hidden="true">
            <div className={styles.copy}>
              <Skeleton className={styles.storeTitle} />
              <Skeleton className={styles.details} />
              <Skeleton className={styles.text} />
              <div className={styles.actions}>
                <Skeleton className={styles.button} />
                <Skeleton className={styles.button} />
              </div>
            </div>
            <Skeleton className={styles.map} />
          </div>
        </div>
      </Container>
    </main>
  )
}
