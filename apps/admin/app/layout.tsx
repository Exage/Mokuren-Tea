import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Cormorant_Garamond, Inter } from 'next/font/google'
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
  title: { default: 'Overview · Mokuren Tea', template: '%s · Mokuren Tea' },
  description: 'Mokuren Tea store administration',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={clsx(headingFont.variable, bodyFont.variable)}>
      <body>{children}</body>
    </html>
  )
}
