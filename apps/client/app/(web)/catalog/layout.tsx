import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Our teas — Mokuren Tea',
  description:
    'From delicate green teas to rich, comforting blends. Discover a tea for every moment.',
}

export default function CatalogLayout({ children }: { children: ReactNode }) {
  return children
}
