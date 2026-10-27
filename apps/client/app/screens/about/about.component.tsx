import { Suspense } from 'react'
import { connection } from 'next/server'
import { getCmsPage } from '@/app/shared/api/requests/cms'
import { cmsText } from '@/app/shared/api/types/cms'
import Image from 'next/image'
import { Button } from '@mokuren/ui/button'
import { Container } from '@/app/shared/components/container'
import { Description } from '@/app/shared/components/description'
import { Eyebrow } from '@/app/shared/components/eyebrow'
import { Title } from '@/app/shared/components/title'
import styles from './about.module.css'

export function AboutScreen() {
  return (
    <Suspense fallback={null}>
      <AboutContent />
    </Suspense>
  )
}

async function AboutContent() {
  await connection()
  const page = await getCmsPage('about')
  const block = page.blocks['about.content']
  const content = block?.content

  return (
    <main className={styles.about}>
      <Container>
        <section className={styles.story} aria-labelledby="about-title">
          <div className={styles.content}>
            <Eyebrow className={styles.eyebrow}>Our story</Eyebrow>
            <Title className={styles.title} id="about-title" size="2xl">
              {cmsText(content, 'title') || 'Tea, thoughtfully chosen.'}
            </Title>
            <Description className={styles.description}>
              {cmsText(content, 'body') ||
                'At Mokuren Tea, we believe a good cup of tea is an invitation to slow down. Our collection brings together familiar favorites and distinctive discoveries, chosen for the moments they create.'}
            </Description>
            {!cmsText(content, 'body') && (
              <Description className={styles.details}>
                Small harvests, honest sourcing, and brewing guidance for beginners and enthusiasts
                alike. Taste patiently — find the cup that feels like yours.
              </Description>
            )}
            <div className={styles.actions}>
              <Button href="/catalog">Explore the Selection</Button>
              <Button href="/contacts" variant="ghost">
                Visit Us
              </Button>
            </div>
          </div>
          <Image
            className={styles.image}
            src={block?.image?.url || '/images/about/about.jpg'}
            alt={
              block?.image
                ? block.image.alt || ''
                : 'Warm café interior with hanging green lamps and a chalkboard menu'
            }
            width={1200}
            height={793}
            preload
            sizes="(max-width: 560px) calc(100vw - 3.2rem), (max-width: 1024px) calc(100vw - 4.8rem), calc((min(100vw, 1200px) - 8.8rem) / 2)"
          />
        </section>
      </Container>
    </main>
  )
}
