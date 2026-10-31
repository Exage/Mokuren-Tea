import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  changeProductStatus,
  createProduct,
  listProducts,
  saveVariant,
  updateProduct,
} from '@/app/shared/api/requests/products'
import type { MediaAsset, Product } from '@/app/shared/api/types/catalog'
import { getMedia } from '@/app/shared/api/requests/media'
import { useCatalogListHook, useCatalogMutationHook } from '@/app/shared/hooks/catalog-data.hook'

export function useProductWorkspaceHook() {
  const mutation = useCatalogMutationHook()
  const [editorVersion, setEditorVersion] = useState(0)
  const [status, setStatus] = useState('')
  const list = useCatalogListHook(listProducts, status)
  const [selected, setSelected] = useState<Product | null | undefined>(undefined)
  const [discardTarget, setDiscardTarget] = useState<Product | null | undefined>(undefined)
  const [closing, setClosing] = useState(false)
  const [dirty, setDirty] = useState(false)
  function changeStatus(value: string) {
    setStatus(value)
    list.setPage(1)
  }
  function select(product: Product | null | undefined) {
    if (dirty) {
      setClosing(product === undefined)
      setDiscardTarget(product === undefined ? null : product)
    } else {
      setSelected(product)
      setEditorVersion((value) => value + 1)
    }
  }
  function confirmDiscard() {
    setEditorVersion((value) => value + 1)
    setSelected(closing ? undefined : discardTarget)
    setClosing(false)
    setDiscardTarget(undefined)
    setDirty(false)
  }
  function saved(product: Product) {
    setSelected(product)
    setDirty(false)
    list.refresh()
  }
  return {
    mutation,
    editorVersion,
    list,
    status,
    changeStatus,
    selected,
    select,
    saved,
    dirty,
    setDirty,
    discardTarget,
    setDiscardTarget,
    confirmDiscard,
  }
}

export function useProductEditorHook(
  product: Product | null,
  onSaved: (product: Product) => void,
  onDirty: (dirty: boolean) => void,
  mutation: ReturnType<typeof useCatalogMutationHook>
) {
  const [category, setCategory] = useState(product?.categoryId ? [product.categoryId] : [])
  const [notes, setNotes] = useState(product?.tasteNoteIds || [])
  const [images, setImages] = useState(product?.imageIds || [])
  const [imageAssets, setImageAssets] = useState<Record<string, MediaAsset>>({})
  const [imageError, setImageError] = useState('')
  const [imageRevision, setImageRevision] = useState(0)
  const imageIdsKey = JSON.stringify([...images].sort())
  useEffect(() => {
    const controller = new AbortController()
    const ids = JSON.parse(imageIdsKey) as string[]
    void Promise.allSettled(ids.map((id) => getMedia(id, controller.signal))).then((results) => {
      if (controller.signal.aborted) {
        return
      }
      const assets = results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : []
      )
      setImageAssets((previous) => ({
        ...previous,
        ...Object.fromEntries(assets.map((asset) => [asset.id, asset])),
      }))
      setImageError(
        results.some((result) => result.status === 'rejected')
          ? 'Some image details could not be loaded. Please retry.'
          : ''
      )
    })
    return () => controller.abort()
  }, [imageIdsKey, imageRevision])
  const [pendingStatus, setPendingStatus] = useState<'publish' | 'archive' | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    nameInputRef.current?.focus({ preventScroll: true })
  }, [])
  function markFormDirty(event: FormEvent<HTMLFormElement>) {
    const target = event.target
    if (
      (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
      ['name', 'slug', 'description', 'threshold'].includes(target.name)
    ) {
      onDirty(true)
    }
  }
  function changeCategory(values: string[]) {
    setCategory(values)
    onDirty(true)
  }
  function changeNotes(values: string[]) {
    setNotes(values)
    onDirty(true)
  }
  function changeImages(values: string[]) {
    setImages(values)
    onDirty(true)
  }
  function moveImageEarlier(index: number) {
    if (index < 1) {
      return
    }
    const next = [...images]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    changeImages(next)
  }
  function removeImage(id: string) {
    changeImages(images.filter((value) => value !== id))
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const input = {
      name: String(form.get('name') || '').trim(),
      description: String(form.get('description') || ''),
      categoryId: category[0] || null,
      tasteNoteIds: notes,
      imageIds: images,
      lowStockThresholdGrams: Number(form.get('threshold')),
    }
    void mutation.run(async () => {
      const result = product
        ? await updateProduct(product.id, input)
        : await createProduct({ ...input, slug: String(form.get('slug') || '').trim() })
      setCategory(result.categoryId ? [result.categoryId] : [])
      setNotes(result.tasteNoteIds)
      setImages(result.imageIds)
      onSaved(result)
    }, 'Product saved.')
  }
  function transition() {
    if (!product || !pendingStatus) {
      return
    }
    void mutation.run(async () => {
      onSaved(await changeProductStatus(product.id, pendingStatus))
      setPendingStatus(null)
    }, 'Product status updated.')
  }
  function variant(event: FormEvent<HTMLFormElement>, variantId?: string) {
    event.preventDefault()
    if (!product) {
      return
    }
    const element = event.currentTarget
    const form = new FormData(element)
    void mutation.run(async () => {
      const result = await saveVariant(
        product.id,
        {
          weightGrams: Number(form.get('weight')),
          price: Number(form.get('price')),
          enabled: form.get('enabled') === 'on',
        },
        variantId
      )
      onSaved(result)
      if (!variantId) {
        element.reset()
      }
    }, 'Pack size saved.')
  }
  return {
    mutation,
    category,
    changeCategory,
    notes,
    changeNotes,
    images,
    imageAssets,
    imageError,
    retryImages: () => setImageRevision((value) => value + 1),
    changeImages,
    moveImageEarlier,
    removeImage,
    pendingStatus,
    nameInputRef,
    setPendingStatus,
    save,
    transition,
    variant,
    markDirty: () => onDirty(true),
    markFormDirty,
  }
}
