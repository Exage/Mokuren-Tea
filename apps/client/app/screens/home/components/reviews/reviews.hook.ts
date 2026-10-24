import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import Fade from 'embla-carousel-fade'

export function useReviewsHook() {
  const carouselId = useId()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const plugins = useMemo(
    () => [
      Autoplay({
        active: !isPaused,
        delay: 5000,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
        stopOnFocusIn: true,
        rootNode: (root) => root.parentElement,
        breakpoints: {
          '(prefers-reduced-motion: reduce)': { active: false },
        },
      }),
      Fade({
        breakpoints: {
          '(prefers-reduced-motion: reduce)': { active: false },
        },
      }),
    ],
    [isPaused]
  )
  const [carouselRef, carouselApi] = useEmblaCarousel(
    {
      loop: true,
      breakpoints: {
        '(prefers-reduced-motion: reduce)': { duration: 0 },
      },
    },
    plugins
  )

  useEffect(() => {
    if (!carouselApi) {
      return
    }

    const updateSelection = () => setSelectedIndex(carouselApi.selectedScrollSnap())
    const updatePlayback = () => setIsPlaying(carouselApi.plugins().autoplay.isPlaying())
    const handlePlay = () => setIsPlaying(true)
    const handleStop = () => setIsPlaying(false)
    const frame = window.requestAnimationFrame(updatePlayback)

    carouselApi
      .on('select', updateSelection)
      .on('reInit', updateSelection)
      .on('reInit', updatePlayback)
      .on('autoplay:play', handlePlay)
      .on('autoplay:stop', handleStop)

    return () => {
      window.cancelAnimationFrame(frame)
      carouselApi
        .off('select', updateSelection)
        .off('reInit', updateSelection)
        .off('reInit', updatePlayback)
        .off('autoplay:play', handlePlay)
        .off('autoplay:stop', handleStop)
    }
  }, [carouselApi])

  const scrollPrevious = () => {
    carouselApi?.scrollPrev()
    carouselApi?.plugins().autoplay.reset()
  }

  const scrollNext = () => {
    carouselApi?.scrollNext()
    carouselApi?.plugins().autoplay.reset()
  }

  const scrollTo = (index: number) => {
    carouselApi?.scrollTo(index)
    carouselApi?.plugins().autoplay.reset()
  }

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
    carouselRef,
    carouselId,
    selectedIndex,
    isPaused,
    isPlaying,
    scrollPrevious,
    scrollNext,
    scrollTo,
    pausePlayback: () => setIsPaused(true),
    togglePlayback: () => setIsPaused((paused) => !paused),
    handleKeyDown,
  }
}
