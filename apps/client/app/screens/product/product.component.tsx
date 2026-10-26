import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Container } from '@/app/shared/components/container'
import { Description } from '@/app/shared/components/description'
import { ProductCard } from '@/app/shared/components/product-card'
import { Title } from '@/app/shared/components/title'
import { MOCK_PRODUCTS } from '@/app/shared/mocks/products'
import { ProductGallery } from './components/product-gallery'
import { ProductReservation } from './components/product-reservation'
import styles from './product.module.css'

export async function ProductScreen({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = MOCK_PRODUCTS.find((item) => item.slug === slug)

  if (!product) {
    notFound()
  }

  const relatedProducts = MOCK_PRODUCTS.filter(
    (item) => item.id !== product.id && item.category === product.category
  ).slice(0, 3)

  return (
    <main className={styles.product}>
      <Container>
        <Link className={styles.back} href="/catalog">
          <span aria-hidden="true">←</span> Back to catalog
        </Link>

        <div className={styles.layout}>
          <ProductGallery key={product.id} product={product} />

          <div className={styles.details}>
            <p className={styles.category}>
              {product.category} <span aria-hidden="true">·</span> {product.origin}
            </p>
            <Title className={styles.title} size="2xl">
              {product.name}
            </Title>
            <Description className={styles.tastes}>{product.tastes.join(' · ')}</Description>
            <Description className={styles.description}>{product.description}</Description>

            <ProductReservation key={product.id} product={product} />

            <p className={styles.notice}>
              Reserve online, pay nothing today. We confirm availability by phone before pickup.
            </p>

            <dl className={styles.specifications}>
              <div className={styles.specification}>
                <dt>Flavor profile</dt>
                <dd>{product.tastes.join(', ')}</dd>
              </div>
              <div className={styles.specification}>
                <dt>Origin</dt>
                <dd>{product.origin}</dd>
              </div>
              <div className={styles.specification}>
                <dt>Water</dt>
                <dd>{product.brewing.temperature}</dd>
              </div>
              <div className={styles.specification}>
                <dt>Steep</dt>
                <dd>
                  {product.brewing.time} · {product.brewing.amount}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {relatedProducts.length > 0 && (
          <section className={styles.related} aria-labelledby="related-title">
            <Title id="related-title" className={styles.relatedTitle} size="xl">
              Pairs well with
            </Title>
            <div className={styles.relatedGrid}>
              {relatedProducts.map((item) => (
                <ProductCard
                  key={item.id}
                  product={item}
                  sizes="(max-width: 560px) calc(100vw - 3.2rem), (max-width: 900px) calc((100vw - 6.8rem) / 2), calc((min(100vw, 1200px) - 8.8rem) / 3)"
                />
              ))}
            </div>
          </section>
        )}
      </Container>
    </main>
  )
}
