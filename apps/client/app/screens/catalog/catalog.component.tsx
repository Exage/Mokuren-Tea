import { Container } from '@/app/shared/components/container'
import { Description } from '@/app/shared/components/description'
import { Eyebrow } from '@/app/shared/components/eyebrow'
import { Title } from '@/app/shared/components/title'
import { CatalogResults } from './components/catalog-results'
import styles from './catalog.module.css'

export function CatalogScreen() {
  return (
    <main className={styles.catalog}>
      <Container>
        <div className={styles.heading}>
          <Eyebrow className={styles.eyebrow}>Our collection</Eyebrow>
          <Title className={styles.title} size="2xl">
            Explore our teas.
          </Title>
          <Description className={styles.description}>
            From delicate green teas to rich, comforting blends. Discover a tea for every moment.
          </Description>
        </div>
        <CatalogResults />
      </Container>
    </main>
  )
}
