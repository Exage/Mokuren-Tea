import { cmsText, type CmsBlock } from '@/app/shared/api/types/cms'
import { Button } from '@mokuren/ui/button'
import { Description } from '@/app/shared/components/description'
import { Eyebrow } from '@/app/shared/components/eyebrow'
import { Title } from '@/app/shared/components/title'
import { ProductCard } from '@/app/shared/components/product-card'
import styles from './products.module.css'

export function Products({ block }: { block?: CmsBlock }) {
  if (!block?.content || !block.products.length) {
    return null
  }

  return (
    <section className={styles.products} aria-labelledby="products-title">
      <div className={styles.heading}>
        <Eyebrow className={styles.eyebrow}>
          {cmsText(block.content, 'eyebrow') || 'Handpicked favorites'}
        </Eyebrow>
        <Title className={styles.title} id="products-title" size="xl">
          {cmsText(block.content, 'title') || 'A cup for every moment.'}
        </Title>
        {cmsText(block.content, 'subtitle') && (
          <Description>{cmsText(block.content, 'subtitle')}</Description>
        )}
      </div>
      <div className={styles.grid}>
        {block.products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      <div className={styles.actions}>
        <Button href="/catalog" variant="secondary">
          View All Teas
        </Button>
      </div>
    </section>
  )
}
