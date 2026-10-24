import { Button } from '@/app/shared/components/button'
import { Container } from '@/app/shared/components/container'
import { Title } from '@/app/shared/components/title'
import styles from './home.module.css'

export function HomeScreen() {
  return (
    <main className={styles.home}>
      <Container>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Japanese tea</p>
          <Title size="3xl">Mokuren Tea</Title>
          <p className={styles.description}>A moment of calm, one cup at a time.</p>
          <Button>123</Button>
          <input type="text" />
          <textarea name="" id=""></textarea>
        </div>

        <div
          style={{
            height: '100dvh',
          }}
        ></div>
      </Container>
    </main>
  )
}
