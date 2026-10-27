import { cmsText, type PublicImage } from '@/app/shared/api/types/cms'
import Image from 'next/image'
import { Button } from '@mokuren/ui/button'
import { Description } from '@/app/shared/components/description'
import { Eyebrow } from '@/app/shared/components/eyebrow'
import { Title } from '@/app/shared/components/title'
import styles from './intro.module.css'

export function Intro({
  content,
  image,
}: {
  content?: Record<string, unknown> | null
  image?: PublicImage | null
}) {
  return (
    <section className={styles.intro} aria-labelledby="intro-title">
      <Image
        className={styles.image}
        src={image?.url || '/images/home/hero-lakeside.jpg'}
        alt={
          image
            ? image.alt || ''
            : 'Ceramic mug of tea and an open book beside calm water at sunset'
        }
        fill
        preload
        sizes="(max-width: 560px) calc(100vw - 3.2rem), calc(min(100vw, 1200px) - 4.8rem)"
      />
      <div className={styles.content}>
        <Eyebrow className={styles.eyebrow}>
          {cmsText(content, 'eyebrow') || 'Welcome to Mokuren Tea'}
        </Eyebrow>
        <Title id="intro-title" size="3xl">
          {cmsText(content, 'title') || 'Find your moment of calm.'}
        </Title>
        <Description className={styles.description}>
          {cmsText(content, 'subtitle') ||
            'Discover thoughtfully selected teas from around the world. From everyday favorites to remarkable new flavors.'}
        </Description>
        <div className={styles.actions}>
          <Button href={cmsText(content, 'buttonUrl') || '/catalog'}>
            {cmsText(content, 'buttonText') || 'Explore Teas'}
          </Button>
          <Button href={cmsText(content, 'secondaryButtonUrl') || '/about'} variant="outlineLight">
            {cmsText(content, 'secondaryButtonText') || 'Our Story'}
          </Button>
        </div>
      </div>
    </section>
  )
}
