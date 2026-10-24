import Image from 'next/image'
import { Button } from '@/app/shared/components/button'
import { Title } from '@/app/shared/components/title'
import styles from './intro.module.css'

export function Intro() {
  return (
    <section className={styles.intro} aria-labelledby="intro-title">
      <Image
        className={styles.image}
        src="/images/home/hero-lakeside.jpg"
        alt="Ceramic mug of tea and an open book beside calm water at sunset"
        fill
        preload
        sizes="(max-width: 560px) calc(100vw - 32px), (max-width: 1200px) calc(100vw - 48px), 1152px"
      />
      <div className={styles.content}>
        <p className={styles.eyebrow}>Welcome to Mokuren Tea</p>
        <Title id="intro-title" size="3xl">
          Find your moment of calm.
        </Title>
        <p className={styles.description}>
          Discover thoughtfully selected teas from around the world. From everyday favorites to
          remarkable new flavors.
        </p>
        <div className={styles.actions}>
          <Button href="/catalog">Explore Teas</Button>
          <Button href="/about" variant="outlineLight">
            Our Story
          </Button>
        </div>
      </div>
    </section>
  )
}
