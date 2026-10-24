'use client'

import clsx from 'clsx'
import { Title } from '@/app/shared/components/title'
import { useReviewsHook } from './reviews.hook'
import styles from './reviews.module.css'

const REVIEWS = [
  { author: 'Alena', quote: 'A little ritual that makes every day feel special.' },
  { author: 'Tomas', quote: 'The Milk Oolong tastes like quiet Sunday mornings.' },
  { author: 'Priya', quote: 'Reserved online, picked up in minutes. Effortless.' },
  { author: 'Marta', quote: 'Sencha converted me from coffee — gently.' },
]

export function Reviews() {
  const {
    carouselRef,
    carouselId,
    selectedIndex,
    isPlaying,
    scrollPrevious,
    scrollNext,
    scrollTo,
    pausePlayback,
    handleKeyDown,
  } = useReviewsHook()

  return (
    <section className={styles.reviews} aria-labelledby={`${carouselId}-title`}>
      <div className={styles.heading}>
        <p className={styles.eyebrow}>Testimonials</p>
        <Title id={`${carouselId}-title`} size="xl" className={styles.title}>
          What our customers say.
        </Title>
      </div>

      <div
        className={styles.carousel}
        role="group"
        aria-roledescription="carousel"
        aria-label="Customer testimonials"
        onKeyDown={handleKeyDown}
      >
        <div className={styles.viewport} ref={carouselRef}>
          <div
            className={styles.slides}
            id={carouselId}
            aria-live={isPlaying ? 'off' : 'polite'}
            aria-atomic="false"
          >
            {REVIEWS.map((review, index) => (
              <div
                key={review.author}
                className={styles.slide}
                id={`${carouselId}-${index}`}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${REVIEWS.length}`}
                aria-hidden={index !== selectedIndex}
              >
                <blockquote className={styles.quote}>
                  <p>{review.quote}</p>
                  <cite className={styles.author}>— {review.author}</cite>
                </blockquote>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.controls}>
          <div className={styles.dots} role="group" aria-label="Choose testimonial">
            {REVIEWS.map((review, index) => (
              <button
                key={review.author}
                className={clsx(styles.dot, index === selectedIndex && styles.active)}
                type="button"
                aria-label={`Show testimonial ${index + 1} by ${review.author}`}
                aria-current={index === selectedIndex ? 'true' : undefined}
                aria-controls={`${carouselId}-${index}`}
                onClick={() => scrollTo(index)}
                onFocus={pausePlayback}
              />
            ))}
          </div>

          <div className={styles.actions}>
            <button
              className={styles.arrow}
              type="button"
              aria-label="Previous testimonial"
              aria-controls={carouselId}
              onClick={scrollPrevious}
              onFocus={pausePlayback}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="m14 6-6 6 6 6" />
              </svg>
            </button>
            <button
              className={styles.arrow}
              type="button"
              aria-label="Next testimonial"
              aria-controls={carouselId}
              onClick={scrollNext}
              onFocus={pausePlayback}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="m10 6 6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
