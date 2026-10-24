import { Container } from '@/app/shared/components/container'
import styles from './not-found.module.css'

export function NotFoundScreen() {
  return (
    <Container>
      <div className={styles.content}>
        <h1 className={styles.title}>404</h1>
      </div>
    </Container>
  )
}
