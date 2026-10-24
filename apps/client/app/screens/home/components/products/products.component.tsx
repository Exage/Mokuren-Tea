import { Button } from '@/app/shared/components/button'
import { Description } from '@/app/shared/components/description'
import { Eyebrow } from '@/app/shared/components/eyebrow'
import { ProductCard } from '@/app/shared/components/product-card'
import { Title } from '@/app/shared/components/title'
import { MOCK_PRODUCTS } from '@/app/shared/mocks/products'
import styles from './products.module.css'

const FEATURED_PRODUCTS = MOCK_PRODUCTS.filter((product) => product.isPopular)

export function Products() {
  return (
    <section className={styles.products} aria-labelledby="products-title">
      <div className={styles.heading}>
        <Eyebrow className={styles.eyebrow}>Handpicked favorites</Eyebrow>
        <Title className={styles.title} id="products-title" size="xl">
          A cup for every moment.
        </Title>
        <Description>Explore the teas our customers keep coming back to.</Description>
      </div>

      <div className={styles.grid}>
        {FEATURED_PRODUCTS.map((product) => (
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
