import type {
  DictionaryEntry,
  DictionaryInput,
  DictionaryKind,
  ListQuery,
  Page,
} from '../types/catalog'
import { catalogRequest } from './catalog-request'

export function listDictionary(kind: DictionaryKind, query: ListQuery, signal?: AbortSignal) {
  return catalogRequest<Page<DictionaryEntry>>(
    `${kind}?${new URLSearchParams({ search: query.search || '', page: String(query.page || 1), limit: '20' })}`,
    { signal }
  )
}
export function saveDictionaryEntry(kind: DictionaryKind, input: DictionaryInput, id?: string) {
  return catalogRequest<DictionaryEntry>(`${kind}${id ? `/${id}` : ''}`, {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(input),
  })
}
export function tasteNoteUsages(id: string) {
  return catalogRequest<{ productsCount: number }>(`taste-notes/${id}/usages`)
}
export function deleteTasteNote(id: string) {
  return catalogRequest<{ affectedProductsCount: number }>(`taste-notes/${id}`, {
    method: 'DELETE',
  })
}
export function deleteCategory(id: string, targetCategoryId?: string) {
  return catalogRequest<{ movedProductsCount: number }>(`categories/${id}/move-and-delete`, {
    method: 'POST',
    body: JSON.stringify(targetCategoryId ? { targetCategoryId } : {}),
  })
}
