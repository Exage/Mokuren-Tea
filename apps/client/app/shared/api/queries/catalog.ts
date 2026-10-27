import { queryOptions } from '@tanstack/react-query'
import { getCatalogProducts } from '../requests/catalog'
import type { CatalogFilter } from '../types/catalog'

export function catalogQueryOptions(filter: CatalogFilter) {
  return queryOptions({
    queryKey: ['catalog', filter],
    queryFn: ({ signal }) =>
      getCatalogProducts(
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
        filter,
        signal
      ),
    staleTime: 5 * 60 * 1000,
  })
}
