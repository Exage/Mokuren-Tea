'use client'

import { ErrorScreen } from '@/app/screens/error'
import '@/app/shared/styles/globals.css'
import styles from './global-error.module.css'

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body className={styles.body}>
        <title>Temporarily unavailable</title>
        <ErrorScreen retry={retry} />
      </body>
    </html>
  )
}
