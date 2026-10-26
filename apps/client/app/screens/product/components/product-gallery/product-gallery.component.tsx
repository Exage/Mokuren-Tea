'use client'

import Image from 'next/image'
import type { Product } from '@/app/shared/interface/product'
import { useProductGalleryHook } from './product-gallery.hook'
import styles from './product-gallery.module.css'

export function ProductGallery({ product }: { product: Product }) {
  const { images, selectedIndex, carouselId, carouselRef, scrollTo, handleKeyDown } =
    useProductGalleryHook(product)

  return (
    <div
      className={styles.gallery}
      role="group"
      aria-roledescription="carousel"
      aria-label={`${product.name} photos`}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.viewport} ref={carouselRef}>
        <div className={styles.slides} id={carouselId}>
          {images.map((image, index) => (
            <div
              key={image.src}
              id={`${carouselId}-${index}`}
              className={styles.slide}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${images.length}`}
              aria-hidden={index !== selectedIndex}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(max-width: 560px) calc(100vw - 3.2rem), (max-width: 900px) calc(100vw - 4.8rem), calc((min(100vw, 1200px) - 8.8rem) / 2)"
                preload={index === 0}
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>
      <div className={styles.thumbnails} role="group" aria-label="Product images">
        {images.map((image, index) => (
          <button
            key={image.src}
            type="button"
            className={styles.thumbnail}
            aria-label={image.label}
            aria-current={selectedIndex === index}
            aria-controls={`${carouselId}-${index}`}
            onClick={() => scrollTo(index)}
          >
            <Image src={image.src} alt="" width={88} height={66} />
          </button>
        ))}
      </div>
    </div>
  )
}
