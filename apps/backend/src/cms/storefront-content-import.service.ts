import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { CmsService } from './cms.service.js'
import { MediaAssetsService } from '../media-assets/media-assets.service.js'
import { ProductsService } from '../products/products.service.js'
import {
  STOREFRONT_CONTENT,
  STOREFRONT_FEATURED_SLUGS,
  STOREFRONT_IMAGES,
} from './storefront-content.js'
import type { CmsBlockKey } from './cms.types.js'
import { validateBlockContent } from './cms-content-validation.js'

export class StorefrontContentImportService {
  constructor(
    private readonly cms: CmsService,
    private readonly media: MediaAssetsService,
    private readonly products: ProductsService
  ) {}

  async importContent(options: { publish?: boolean } = {}) {
    await this.cms.initializeFixedBlocks(null)
    const { items: blocks } = await this.cms.listBlocksAdmin()
    const empty = blocks.filter(
      (block) => !block.draft && !block.published && block.draftVersion === 0
    )
    const pendingImages = STOREFRONT_IMAGES.filter((image) =>
      empty.some((block) => block.blockKey === image.blockKey)
    )
    // Preflight every input before uploading or saving any content.
    const files = await Promise.all(
      pendingImages.map(async (image) => ({
        image,
        buffer: await readFile(new URL(`../../../client/public/${image.path}`, import.meta.url)),
      }))
    )
    const teaIds: string[] = []
    if (empty.some((block) => block.blockKey === 'home.featuredTeas')) {
      for (const slug of STOREFRONT_FEATURED_SLUGS) {
        const page = await this.products.listAdmin({
          search: slug,
          status: 'published',
          page: 1,
          limit: 100,
        })
        const tea = page.items.find((product) => product.slug === slug)
        if (!tea) {
          throw new Error(
            `Publish the existing product "${slug}" before importing storefront content`
          )
        }
        teaIds.push(tea.id)
      }
    }
    const contents = empty.map((block) => {
      const content = {
        ...STOREFRONT_CONTENT[block.blockKey],
        ...(block.blockKey === 'home.featuredTeas' ? { teaIds } : {}),
      }
      const result = validateBlockContent(block.blockKey, content)
      if (!result.success) {
        throw new Error(result.errors.join('; '))
      }
      return { block, content: result.data }
    })
    const images = new Map<CmsBlockKey, string>()
    for (const { image, buffer } of files) {
      const page = await this.media.list({ search: image.name, status: 'ready', limit: 100 })
      const existing = page.items.find(
        (asset) => asset.name === image.name && asset.originalName === basename(image.path)
      )
      const asset =
        existing ||
        (await this.media.uploadImageFile(
          {
            buffer,
            originalname: basename(image.path),
            mimetype: 'image/jpeg',
            size: buffer.length,
          },
          image.alt,
          undefined,
          image.name,
          { preserveDimensions: true }
        ))
      images.set(image.blockKey, asset.id)
    }
    const imported: string[] = []
    for (const { block, content } of contents) {
      const imageId = images.get(block.blockKey)
      await this.cms.saveDraft({
        pageKey: block.pageKey,
        blockKey: block.blockKey,
        expectedDraftVersion: block.draftVersion,
        content: { ...content, ...(imageId ? { imageId } : {}) },
      })
      if (options.publish) {
        await this.cms.publishBlock({ pageKey: block.pageKey, blockKey: block.blockKey })
      }
      imported.push(block.blockKey)
    }
    return {
      imported,
      skipped: blocks.filter((block) => !empty.includes(block)).map((block) => block.blockKey),
      imageIds: Object.fromEntries(images),
      published: !!options.publish,
    }
  }
}
