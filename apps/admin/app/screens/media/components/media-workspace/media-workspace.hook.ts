import { useState } from 'react'
import type { FormEvent } from 'react'
import { AdminAuthError } from '@/app/shared/api/requests/admin-auth'
import {
  deleteMedia,
  listMedia,
  mediaUsages,
  updateMedia,
  uploadMedia,
} from '@/app/shared/api/requests/media'
import type { MediaAsset, MediaUsage } from '@/app/shared/api/types/catalog'
import { useCatalogListHook, useCatalogMutationHook } from '@/app/shared/hooks/catalog-data.hook'

export function useMediaWorkspaceHook() {
  const list = useCatalogListHook(listMedia)
  const mutation = useCatalogMutationHook()
  const [editing, setEditing] = useState<MediaAsset | null>(null)
  const [deleting, setDeleting] = useState<MediaAsset | null>(null)
  const [usages, setUsages] = useState<MediaUsage[] | null>(null)
  function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const element = event.currentTarget
    const form = new FormData(element)
    void mutation.run(async () => {
      const file = form.get('file')
      if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024) {
        throw new AdminAuthError(
          400,
          'VALIDATION_ERROR',
          'Choose a JPG, PNG, or WebP image up to 10 MB.'
        )
      }
      if (!String(form.get('name') || '').trim()) {
        form.delete('name')
      }
      await uploadMedia(form)
      element.reset()
      list.refresh()
    }, 'Image uploaded.')
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) {
      return
    }
    const form = new FormData(event.currentTarget)
    void mutation.run(async () => {
      await updateMedia(editing.id, {
        name: String(form.get('name') || '').trim(),
        alt: String(form.get('alt') || ''),
      })
      setEditing(null)
      list.refresh()
    }, 'Image details saved.')
  }
  function prepareDelete(asset: MediaAsset) {
    setDeleting(asset)
    setUsages(null)
    void mutation.run(async () => setUsages(await mediaUsages(asset.id)), '')
  }
  function remove() {
    if (!deleting) {
      return
    }
    void mutation.run(async () => {
      await deleteMedia(deleting.id)
      setDeleting(null)
      if (editing?.id === deleting.id) {
        setEditing(null)
      }
      list.refresh()
    }, 'Image deletion started. The server will finish removing the file.')
  }
  return {
    list,
    mutation,
    editing,
    setEditing,
    deleting,
    setDeleting,
    usages,
    upload,
    save,
    prepareDelete,
    remove,
  }
}
