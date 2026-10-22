import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import '@/app/shared/styles/globals.css'

export const metadata: Metadata = {
  title: 'Mokuren Tea',
  description: 'Japanese tea. A moment of calm, one cup at a time.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
