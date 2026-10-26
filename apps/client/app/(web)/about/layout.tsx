import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Our story — Mokuren Tea',
  description:
    'Small harvests, honest sourcing, and thoughtfully chosen teas. Discover the story behind Mokuren Tea.',
}

export default function AboutLayout({ children }: { children: ReactNode }) {
  return children
}
