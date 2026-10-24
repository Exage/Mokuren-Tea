import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import { Header } from '@/app/shared/components/header'
import styles from './layout.module.css'
import '@/app/shared/styles/globals.css'

const headingFont = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
})

const bodyFont = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Mokuren Tea',
  description: 'Japanese tea. A moment of calm, one cup at a time.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={clsx(headingFont.variable, bodyFont.variable)}>
      <body className={styles.body}>
        <Header />
        {children}
      </body>
    </html>
  )
}
