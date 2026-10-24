import Image from 'next/image'
import { Button } from '@/app/shared/components/button'
import { Description } from '@/app/shared/components/description'
import { Eyebrow } from '@/app/shared/components/eyebrow'
import { Title } from '@/app/shared/components/title'
import styles from './visit.module.css'

export function Visit() {
  return (
    <section className={styles.visit} aria-labelledby="visit-title">
      <div className={styles.content}>
        <Eyebrow className={styles.eyebrow}>Visit our store</Eyebrow>
        <Title className={styles.title} id="visit-title" size="xl">
          Reserve online. Collect in person.
        </Title>
        <Description className={styles.description}>
          Find your favorite teas online and collect them at our store.
        </Description>

        <dl className={styles.details}>
          <div className={styles.detail}>
            <dt className={styles.label}>Address</dt>
            <dd className={styles.value}>
              <address className={styles.address}>12 Calm Lane, Minsk</address>
            </dd>
          </div>
          <div className={styles.detail}>
            <dt className={styles.label}>Opening hours</dt>
            <dd className={styles.value}>Daily, 10:00–20:00</dd>
          </div>
        </dl>

        <Button href="/contacts" variant="outlineLight">
          Get Directions
        </Button>
      </div>

      <div className={styles.photo}>
        <Image
          className={styles.image}
          src="/images/home/store-shelf.jpg"
          alt="Glass jars of loose-leaf tea arranged on wooden shelves in a tea boutique"
          fill
          sizes="(max-width: 560px) calc(100vw - 3.2rem), (max-width: 1024px) calc(100vw - 4.8rem), calc((min(100vw, 1200px) - 7.2rem) * 0.58)"
        />
      </div>
    </section>
  )
}
