'use client'

import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { useQueryProviderHook } from './query-provider.hook'

export function QueryProvider({ children }: { children: ReactNode }) {
  const client = useQueryProviderHook()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
