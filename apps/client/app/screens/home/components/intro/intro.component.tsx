import Image from 'next/image'
import { Button } from '@/app/shared/components/button'
import { Description } from '@/app/shared/components/description'
import { Eyebrow } from '@/app/shared/components/eyebrow'
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
        sizes="(max-width: 560px) calc(100vw - 3.2rem), calc(min(100vw, 1200px) - 4.8rem)"
      />
      <div className={styles.content}>
        <Eyebrow className={styles.eyebrow}>Welcome to Mokuren Tea</Eyebrow>
        <Title id="intro-title" size="3xl">
          Find your moment of calm.
        </Title>
        <Description className={styles.description}>
          Discover thoughtfully selected teas from around the world. From everyday favorites to
          remarkable new flavors.
        </Description>
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
