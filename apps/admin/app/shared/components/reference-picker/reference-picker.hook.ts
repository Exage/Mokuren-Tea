import { useCallback, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { listDictionary } from '../../api/requests/dictionaries'
import { listMedia } from '../../api/requests/media'
import type { DictionaryKind, ListQuery, Page } from '../../api/types/catalog'
import { useCatalogListHook } from '../../hooks/catalog-data.hook'

export type ReferenceKind = DictionaryKind | 'media'
export interface ReferenceOption {
  id: string
  name: string
  url?: string | null
}
export function useReferencePickerHook(kind: ReferenceKind) {
  const [names, setNames] = useState<Record<string, string>>({})
  const load = useCallback(
    async (query: ListQuery, signal: AbortSignal): Promise<Page<ReferenceOption>> => {
      const result =
        kind === 'media'
          ? await listMedia(query, signal)
          : await listDictionary(kind, query, signal)
      if (!signal.aborted) {
        setNames((previous) => ({
          ...previous,
          ...Object.fromEntries(result.items.map((item) => [item.id, item.name])),
        }))
      }
      return result
    },
    [kind]
  )
  const list = useCatalogListHook(load)
  function preventSearchSubmit(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
    }
  }
  return { ...list, names, preventSearchSubmit }
}
