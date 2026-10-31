import Image from 'next/image'
import { Button } from '@mokuren/ui/button'
import type { CmsPreview } from '@/app/shared/api/types/cms'
import { contentBlocks } from '../content-workspace/content-fields'
import { useContentPreviewHook } from './content-preview.hook'
import styles from './content-preview.module.css'

export function ContentPreview({ preview, selected }: { preview: CmsPreview; selected: string }) {
  const { assets, retry } = useContentPreviewHook(preview)
  return (
    <div className={styles.stack}>
      {!assets && <p role="status">Loading images and teas…</p>}
      {assets?.error && (
        <div role="alert">
          {assets.error}{' '}
          <Button variant="ghost" onClick={retry}>
            Retry
          </Button>
        </div>
      )}
      {Object.entries(preview.blocks).map(([key, content]) => {
        const image = content?.imageId ? assets?.media[content.imageId] : null
        return (
          <section className={styles.section} key={key}>
            <p className={styles.label}>
              {contentBlocks.find((item) => item.key === key)?.title} ·{' '}
              {key === selected ? 'Saved draft' : 'Published'}
            </p>
            {!content ? (
              <p>No content yet.</p>
            ) : (
              <>
                {image?.url && (
                  <Image
                    unoptimized
                    src={image.url}
                    alt={image.alt || ''}
                    width={720}
                    height={360}
                    className={styles.image}
                  />
                )}
                {content.eyebrow && <p className={styles.eyebrow}>{content.eyebrow}</p>}
                {content.title && <h3>{content.title}</h3>}
                {content.subtitle && <p>{content.subtitle}</p>}
                {content.body && <p className={styles.body}>{content.body}</p>}
                <div className={styles.buttons}>
                  {content.buttonText && <span>{content.buttonText}</span>}
                  {content.secondaryButtonText && <span>{content.secondaryButtonText}</span>}
                </div>
                {content.testimonials?.map((item, index) => (
                  <blockquote key={index}>
                    <p>“{item.text}”</p>
                    <footer>
                      {item.name}
                      {item.rating ? ` · ${'★'.repeat(item.rating)}` : ''}
                    </footer>
                  </blockquote>
                ))}
                {!!content.teaIds?.length && (
                  <div className={styles.teas}>
                    {content.teaIds.map((id) => {
                      const tea = assets?.products[id]
                      return (
                        <div key={id}>
                          {tea?.images[0]?.url && (
                            <Image
                              unoptimized
                              src={tea.images[0].url}
                              alt={tea.images[0].alt || ''}
                              width={180}
                              height={180}
                              className={styles.teaImage}
                            />
                          )}
                          <strong>
                            {tea?.name || (assets ? 'Tea unavailable' : 'Loading tea…')}
                          </strong>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </section>
        )
      })}
    </div>
  )
}
