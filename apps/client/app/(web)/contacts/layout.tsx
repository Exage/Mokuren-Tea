import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Contacts — Mokuren Tea',
  description:
    'Come say hello at Mokuren Tea in Minsk. Find our contact details, opening hours, and a map to plan your visit.',
}

export default function ContactsLayout({ children }: { children: ReactNode }) {
  return children
}
