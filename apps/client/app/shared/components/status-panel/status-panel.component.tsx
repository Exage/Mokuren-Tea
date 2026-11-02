import type { ReactNode } from 'react'
import { Container } from '@/app/shared/components/container'
import { Eyebrow } from '@/app/shared/components/eyebrow'
import { Title } from '@/app/shared/components/title'
import { Description } from '@/app/shared/components/description'
import styles from './status-panel.module.css'

export function StatusPanel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <main className={styles.main}>
      <Container>
        <section className={styles.panel} aria-labelledby="status-title">
          <div className={styles.mark} aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M10 21h24v10a10 10 0 0 1-10 10h-4a10 10 0 0 1-10-10V21Z" />
              <path d="M34 23h3a5 5 0 0 1 0 10h-3M18 14c0-3 3-3 3-7M27 14c0-3 3-3 3-7" />
            </svg>
          </div>
          <Eyebrow className={styles.eyebrow}>{eyebrow}</Eyebrow>
          <Title id="status-title" size="2xl">
            {title}
          </Title>
          <Description className={styles.description}>{description}</Description>
          <div className={styles.actions}>{children}</div>
        </section>
      </Container>
    </main>
  )
}
