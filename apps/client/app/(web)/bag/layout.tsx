import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Reservation bag',
  description: 'Review your teas and request a reservation for in-store pickup.',
}

export default function BagLayout({ children }: { children: ReactNode }) {
  return children
}
