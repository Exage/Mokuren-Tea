import clsx from 'clsx'
import Image from 'next/image'
import Link from 'next/link'
import { Title } from '@/app/shared/components/title'
import type { PublicProduct } from '@/app/shared/api/types/cms'
import styles from './product-card.module.css'

type ProductCardProps = {
  product: PublicProduct
  className?: string
  sizes?: string
}

export function ProductCard({
  product,
  className,
  sizes = '(max-width: 400px) calc(100vw - 3.2rem), (max-width: 560px) calc((100vw - 4.4rem) / 2), (max-width: 1024px) calc((100vw - 6.8rem) / 2), calc((min(100vw, 1200px) - 10.8rem) / 4)',
}: ProductCardProps) {
  return (
    <article className={clsx(styles.card, className)}>
      <Link className={styles.link} href={`/catalog/${product.slug}`}>
        <Image
          className={styles.image}
          src={product.images[0]?.url || '/images/tea-placeholder.svg'}
          alt={product.images[0]?.alt || ''}
          fill
          sizes={sizes}
        />
        <div className={styles.content}>
          <Title className={styles.title} size="md">
            {product.name}
          </Title>
          {product.minPrice !== null && (
            <p className={styles.price}>from {product.minPrice.toFixed(2)} BYN</p>
          )}
          {product.outOfStock && <p>Out of stock</p>}
        </div>
      </Link>
    </article>
  )
}
