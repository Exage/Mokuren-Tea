import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProduct } from '@/app/shared/api/requests/products'
import { Container } from '@/app/shared/components/container'
import { Description } from '@/app/shared/components/description'
import { Title } from '@/app/shared/components/title'
import { ProductGallery } from './components/product-gallery'
import { ProductReservation } from './components/product-reservation'
import styles from './product.module.css'

export async function ProductScreen({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await getProduct(slug)
  if (!product) {
    notFound()
  }

  return (
    <main className={styles.product}>
      <Container>
        <Link className={styles.back} href="/catalog">
          <span aria-hidden="true">←</span> Back to catalog
        </Link>
        <div className={styles.layout}>
          {product.images.length > 0 ? (
            <ProductGallery key={product.id} product={product} />
          ) : (
            <div className={styles.placeholder}>
              <Image
                src="/images/tea-placeholder.svg"
                alt=""
                fill
                sizes="(max-width: 900px) 100vw, 600px"
              />
            </div>
          )}
          <div className={styles.details}>
            <Title className={styles.title} size="2xl">
              {product.name}
            </Title>
            <Description className={styles.description}>{product.description}</Description>
            <ProductReservation key={product.id} product={product} />
            <p className={styles.notice}>
              Reserve online, pay nothing today. We confirm availability by phone before pickup.
            </p>
          </div>
        </div>
      </Container>
    </main>
  )
}
