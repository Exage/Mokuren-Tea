import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import type { PublicProduct } from '@/app/shared/api/types/cms'

export function useProductGalleryHook(product: PublicProduct) {
  const carouselId = useId()
  const images = product.images.map((image, index) => ({
    src: image.url,
    alt: image.alt || '',
    label: `Product image ${index + 1}`,
  }))
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
