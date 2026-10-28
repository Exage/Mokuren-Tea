import type { ReactNode } from 'react'
import styles from './auth-frame.module.css'

export function AuthFrame({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="auth-title">
        <p className={styles.brand}>Mokuren Tea</p>
        <h1 id="auth-title" className={styles.title}>
          {title}
        </h1>
        <p className={styles.description}>{description}</p>
        {children}
      </section>
    </main>
  )
}
