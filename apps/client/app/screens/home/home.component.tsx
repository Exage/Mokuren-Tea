import { Suspense } from 'react'
import { connection } from 'next/server'
import { getCmsPage } from '@/app/shared/api/requests/cms'
import { Container } from '@/app/shared/components/container'
import { Intro } from '@/app/screens/home/components/intro'
import { Reviews } from '@/app/screens/home/components/reviews'
import { Products } from '@/app/screens/home/components/products'
import { Visit } from '@/app/screens/home/components/visit'
import styles from './home.module.css'

export function HomeScreen() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  )
}

async function HomeContent() {
  await connection()
  const page = await getCmsPage('home')
  const hero = page.blocks['home.hero']
  const visit = page.blocks['home.visitStore']
  const testimonials = page.blocks['home.testimonials']?.content

  return (
    <main className={styles.home}>
      <Container>
        <Intro content={hero?.content} image={hero?.image} />
        <Reviews content={testimonials} />
        <Products block={page.blocks['home.featuredTeas']} />
        <Visit content={visit?.content} image={visit?.image} />
      </Container>
    </main>
  )
}
