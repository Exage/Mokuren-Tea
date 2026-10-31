import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Our story',
  description: 'Small harvests, honest sourcing, and thoughtfully chosen teas.',
}

export default function AboutLayout({ children }: { children: ReactNode }) {
  return children
}
