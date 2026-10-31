import { getStoreSettings } from '@/app/shared/api/requests/store-settings'
import type { Metadata } from 'next'
import { Suspense, type ReactNode } from 'react'
import clsx from 'clsx'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import { Header } from '@/app/shared/components/header'
import { Footer } from '@/app/shared/components/footer'
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

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings()
  return {
    title: {
      default: settings?.name || 'Tea store',
      template: `%s — ${settings?.name || 'Tea store'}`,
    },
    description: settings?.tagline || undefined,
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const settings = await getStoreSettings()
  return (
    <html lang="en" className={clsx(headingFont.variable, bodyFont.variable)}>
      <body className={styles.body}>
        <Suspense fallback={null}>
          <Header name={settings?.name || 'Tea store'} />
        </Suspense>

        {children}

        <Footer settings={settings} />
      </body>
    </html>
  )
}
