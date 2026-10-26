import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import type { Product } from '@/app/shared/interface/product'

export function useProductGalleryHook(product: Product) {
  const carouselId = useId()
  const images = [
    { src: product.image, alt: `${product.name} product photograph`, label: 'Product photograph' },
    { src: '/images/products/tea-cup.jpg', alt: 'Brewed cup of tea', label: 'Brewed cup detail' },
    { src: '/images/about/about.jpg', alt: 'A quiet tea ritual', label: 'Tea ritual detail' },
  ]
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [carouselRef, carouselApi] = useEmblaCarousel({
    loop: true,
    breakpoints: {
      '(prefers-reduced-motion: reduce)': { duration: 0 },
    },
  })

  useEffect(() => {
    if (!carouselApi) {
      return
    }

    const updateSelection = () => setSelectedIndex(carouselApi.selectedScrollSnap())
    const frame = window.requestAnimationFrame(updateSelection)
    carouselApi.on('select', updateSelection).on('reInit', updateSelection)

    return () => {
      window.cancelAnimationFrame(frame)
      carouselApi.off('select', updateSelection).off('reInit', updateSelection)
    }
  }, [carouselApi])

  const scrollPrevious = () => carouselApi?.scrollPrev()
  const scrollNext = () => carouselApi?.scrollNext()
  const scrollTo = (index: number) => carouselApi?.scrollTo(index)

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      scrollPrevious()
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      scrollNext()
    }
  }

  return {
    images,
    selectedIndex,
    carouselId,
    carouselRef,
    scrollTo,
    handleKeyDown,
  }
}
