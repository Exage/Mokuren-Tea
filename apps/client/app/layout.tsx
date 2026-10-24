import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Header } from '@/app/shared/components/header'
import styles from './layout.module.css'
import '@/app/shared/styles/globals.css'

export const metadata: Metadata = {
  title: 'Mokuren Tea',
  description: 'Japanese tea. A moment of calm, one cup at a time.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={styles.body}>
        <Header />
        {children}
      </body>
    </html>
  )
}
