import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  deleteCategory,
  deleteTasteNote,
  listDictionary,
  saveDictionaryEntry,
  tasteNoteUsages,
} from '../../api/requests/dictionaries'
import type { DictionaryEntry, DictionaryKind, ListQuery } from '../../api/types/catalog'
import { useCatalogListHook, useCatalogMutationHook } from '../../hooks/catalog-data.hook'

export function useDictionaryEditorHook(kind: DictionaryKind) {
  const load = useCallback(
    (query: ListQuery, signal: AbortSignal) => listDictionary(kind, query, signal),
    [kind]
  )
  const list = useCatalogListHook(load)
  const mutation = useCatalogMutationHook()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<DictionaryEntry | null>(null)
  const [deleting, setDeleting] = useState<DictionaryEntry | null>(null)
  const [usageCount, setUsageCount] = useState<number | null>(null)
  const [target, setTarget] = useState<string[]>([])
  const [formVersion, setFormVersion] = useState(0)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const deleteHeadingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (deleting) {
      deleteHeadingRef.current?.focus()
    } else if (editorOpen) {
      nameInputRef.current?.focus()
    }
  }, [deleting, editing, editorOpen])
  function create() {
    if (mutation.busy) {
      return
    }
    setDeleting(null)
    setEditing(null)
    setEditorOpen(true)
  }
  function closeEditor() {
    if (mutation.busy) {
      return
    }
    setEditorOpen(false)
    setEditing(null)
  }
  function edit(entry: DictionaryEntry) {
    if (mutation.busy) {
      return
    }
    setDeleting(null)
    setEditing(entry)
    setEditorOpen(true)
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void mutation.run(async () => {
      await saveDictionaryEntry(
        kind,
        {
          name: String(form.get('name') || '').trim(),
          slug: String(form.get('slug') || '').trim(),
          sortOrder: Number(form.get('sortOrder')),
        },
        editing?.id
      )
      setEditing(null)
      setEditorOpen(false)
      setFormVersion((value) => value + 1)
      list.refresh()
    }, 'Saved successfully.')
  }
  function prepareDelete(entry: DictionaryEntry) {
    setDeleting(entry)
    setTarget([])
    setUsageCount(null)
    if (kind === 'taste-notes') {
      void mutation.run(async () => {
        const result = await tasteNoteUsages(entry.id)
        setUsageCount(result.productsCount)
      }, '')
    } else {
      setUsageCount(entry.productsCount)
    }
  }
  function remove() {
    if (!deleting) {
      return
    }
    void mutation.run(async () => {
      if (kind === 'categories') {
        await deleteCategory(deleting.id, target[0])
      } else {
        await deleteTasteNote(deleting.id)
      }
      if (editing?.id === deleting.id) {
        setEditing(null)
      }
      setDeleting(null)
      list.refresh()
    }, 'Deleted successfully.')
  }
  return {
    list,
    mutation,
    editing,
    editorOpen,
    create,
    closeEditor,
    deleting,
    setDeleting,
    usageCount,
    target,
    setTarget,
    formVersion,
    nameInputRef,
    deleteHeadingRef,
    edit,
    save,
    prepareDelete,
    remove,
  }
}
