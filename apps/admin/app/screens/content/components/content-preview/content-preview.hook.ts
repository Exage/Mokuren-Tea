import { useEffect, useState } from 'react'
import { getMedia } from '@/app/shared/api/requests/media'
import { getProduct } from '@/app/shared/api/requests/products'
import type { CmsPreview } from '@/app/shared/api/types/cms'
import type { MediaAsset, Product } from '@/app/shared/api/types/catalog'

export function useContentPreviewHook(preview: CmsPreview) {
  const [assets, setAssets] = useState<{
    media: Record<string, MediaAsset>
    products: Record<string, Product>
    error: string
  } | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const contents = Object.values(preview.blocks)
    const imageIds = [
      ...new Set(contents.flatMap((value) => (value?.imageId ? [value.imageId] : []))),
    ]
    const teaIds = [...new Set(contents.flatMap((value) => value?.teaIds || []))]
    void Promise.all([
      Promise.allSettled(imageIds.map((id) => getMedia(id, controller.signal))),
      Promise.allSettled(teaIds.map((id) => getProduct(id, controller.signal))),
    ]).then(([images, teas]) => {
      if (controller.signal.aborted) {
        return
      }
      setAssets({
        media: Object.fromEntries(
          images.flatMap((value) =>
            value.status === 'fulfilled' ? [[value.value.id, value.value]] : []
          )
        ),
        products: Object.fromEntries(
          teas.flatMap((value) =>
            value.status === 'fulfilled' ? [[value.value.id, value.value]] : []
          )
        ),
        error: [...images, ...teas].some((value) => value.status === 'rejected')
          ? 'Some images or teas could not be loaded.'
          : '',
      })
    })
    return () => controller.abort()
  }, [preview, retry])
  return { assets, retry: () => setRetry((value) => value + 1) }
}
