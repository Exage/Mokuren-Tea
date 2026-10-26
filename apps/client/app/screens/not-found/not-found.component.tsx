import { Container } from '@/app/shared/components/container'
import styles from './not-found.module.css'
import { Title } from '@/app/shared/components/title'
import { Description } from '@/app/shared/components/description'

export function NotFoundScreen() {
  return (
    <Container className={styles.container}>
      <div className={styles.content}>
        <Title size="3xl">404</Title>
        <Description className={styles.description}>Page not found</Description>
      </div>
    </Container>
  )
}
