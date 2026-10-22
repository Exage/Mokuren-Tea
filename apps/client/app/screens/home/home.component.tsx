import { Container } from '@/app/shared/components/container'
import styles from './home.module.css'

export function HomeScreen() {
  return (
    <main className={styles.home}>
      <Container>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Japanese tea</p>
          <h1 className={styles.title}>Mokuren Tea</h1>
          <p className={styles.description}>A moment of calm, one cup at a time.</p>
          <button>
            123
          </button>
          <input type="text" />
          <textarea name="" id=""></textarea>
        </div>
      </Container>
    </main>
  )
}
