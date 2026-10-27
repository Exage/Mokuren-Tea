import Image from 'next/image'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { getInitialCatalog } from '@/app/shared/api/requests/catalog.server'
import { getCmsPage } from '@/app/shared/api/requests/cms'
import { cmsText } from '@/app/shared/api/types/cms'
import { Container } from '@/app/shared/components/container'
import { Description } from '@/app/shared/components/description'
import { Eyebrow } from '@/app/shared/components/eyebrow'
import { Title } from '@/app/shared/components/title'
import { CatalogResults } from './components/catalog-results'
import { CatalogQueryProvider } from './components/catalog-results/catalog-query-provider'
import styles from './catalog.module.css'

export function CatalogScreen() {
  return (
    <Suspense fallback={null}>
      <CatalogContent />
    </Suspense>
  )
}

async function CatalogContent() {
  await connection()
  const [page, catalog] = await Promise.all([getCmsPage('catalog'), getInitialCatalog()])
  const block = page.blocks['catalog.header']
  const content = block?.content

  return (
    <main className={styles.catalog}>
      <Container>
        <div className={styles.heading}>
          <Eyebrow className={styles.eyebrow}>Our collection</Eyebrow>
          <Title className={styles.title} size="2xl">
            {cmsText(content, 'title') || 'Explore our teas.'}
          </Title>
          <Description className={styles.description}>
            {cmsText(content, 'subtitle') ||
              'From delicate green teas to rich, comforting blends. Discover a tea for every moment.'}
          </Description>
        </div>
        {block?.image && (
          <div className={styles.image}>
            <Image
              src={block.image.url}
              alt={block.image.alt || ''}
              fill
              sizes="(max-width: 1200px) 100vw, 1200px"
            />
          </div>
        )}
        <CatalogQueryProvider>
          <CatalogResults initial={catalog} />
        </CatalogQueryProvider>
      </Container>
    </main>
  )
}
