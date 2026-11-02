import { useState } from 'react'
import { QueryClient } from '@tanstack/react-query'

export function useQueryProviderHook() {
  const [client] = useState(
    () =>
      new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })
  )
  return client
}
