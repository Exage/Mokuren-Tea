import { Button } from '@mokuren/ui/button'
import { PageHeading } from '@/app/shared/components/page-heading'
import styles from './section-preview.module.css'

type SectionPreviewProps = {
  eyebrow: string
  title: string
  description: string
  features: string[]
}

export function SectionPreview({ eyebrow, title, description, features }: SectionPreviewProps) {
  return (
    <div>
      <PageHeading eyebrow={eyebrow} title={title} description={description} />
      <section className={styles.panel} aria-label="Section features">
        <span className={styles.badge}>Coming soon</span>
        <h2 className={styles.title}>This section is being prepared</h2>
        <p className={styles.description}>Store data and editing tools are not connected yet.</p>
        <ul className={styles.features}>
          {features.map((feature, index) => (
            <li key={feature}>
              <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              {feature}
            </li>
          ))}
        </ul>
        <Button href="/" variant="secondary">
          Back to overview
        </Button>
      </section>
    </div>
  )
}
