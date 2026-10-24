import { Container } from '@/app/shared/components/container'
import { Intro } from '@/app/screens/home/components/intro'
import { Reviews } from '@/app/screens/home/components/reviews'
import { Products } from '@/app/screens/home/components/products'
import styles from './home.module.css'

export function HomeScreen() {
  return (
    <main className={styles.home}>
      <Container>
        <Intro />
        <Reviews />
        <Products />
      </Container>
    </main>
  )
}
