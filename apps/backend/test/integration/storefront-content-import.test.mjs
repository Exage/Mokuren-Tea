import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { CmsService } from '../../dist/cms/cms.service.js'
import { MediaAssetsService } from '../../dist/media-assets/media-assets.service.js'
import { ProductsService } from '../../dist/products/products.service.js'
import { StorefrontContentImportService } from '../../dist/cms/storefront-content-import.service.js'
import { STOREFRONT_FEATURED_SLUGS } from '../../dist/cms/storefront-content.js'
import { seedReferences, startTestApp, stopTestApp } from './setup.mjs'

let app
let replSet
let importer
let cms
let uploads = 0
before(async () => {
  const started = await startTestApp('mokuren_storefront_import_test', {
    cloudinary: {
      isConfigured: () => true,
      buildPublicId: (id) => `storefront-test-${id}`,
      uploadImage: async (buffer, publicId, options) => {
        assert.equal(options.preserveDimensions, true)
        uploads += 1
        return {
          assetId: publicId,
          publicId,
          version: 1,
          secureUrl: `https://res.cloudinary.com/test/image/upload/${publicId}.jpg`,
          format: 'jpg',
          bytes: buffer.length,
          width: 1600,
          height: 900,
        }
      },
    },
  })
  ;({ app, replSet } = started)
  const refs = await seedReferences(started.db)
  const products = app.get(ProductsService)
  for (const slug of STOREFRONT_FEATURED_SLUGS) {
    const product = await products.createDraft({
      name: slug,
      slug,
      categoryId: refs.categoryId,
      imageIds: [refs.imageId],
      variants: [{ weightGrams: 50, price: 10, enabled: true }],
    })
    await products.publish(product.id)
  }
  cms = app.get(CmsService)
  importer = new StorefrontContentImportService(cms, app.get(MediaAssetsService), products)
})
after(async () => {
  if (app) {
    await stopTestApp(app, replSet)
  }
})

test('imports existing copy and three media assets, preserves edits and repeats without duplicate uploads', async () => {
  await cms.initializeFixedBlocks(null)
  await cms.saveDraft({
    pageKey: 'catalog',
    blockKey: 'catalog.header',
    content: { title: 'An existing editor draft' },
    expectedDraftVersion: 0,
  })
  const result = await importer.importContent({ publish: true })
  assert.equal(result.imported.length, 6)
  assert.deepEqual(result.skipped, ['catalog.header'])
  assert.equal(uploads, 3)
  const home = await cms.getPublishedPage('home')
  assert.equal(home.blocks['home.hero'].content.title, 'Find your moment of calm.')
  assert.ok(home.blocks['home.hero'].image.url.includes('res.cloudinary.com'))
  assert.equal(home.blocks['home.hero'].image.width, 1600)
  assert.equal(home.blocks['home.testimonials'].content.testimonials.length, 4)
  assert.equal(home.blocks['home.featuredTeas'].products.length, 4)
  const catalog = await cms.getBlockAdmin('catalog', 'catalog.header')
  assert.equal(catalog.draft.title, 'An existing editor draft')
  assert.equal(catalog.published, null)
  const contacts = await cms.getBlockAdmin('contacts', 'contacts.content')
  assert.equal(contacts.published.location, undefined)
  const about = await cms.getBlockAdmin('about', 'about.content')
  assert.match(about.published.body, /Small harvests/)
  const media = await app.get(MediaAssetsService).list({ limit: 100 })
  assert.ok(
    media.items
      .filter((asset) => asset.name.startsWith('Storefront'))
      .every((asset) => asset.usageCount === 3)
  )
  const second = await importer.importContent({ publish: true })
  assert.equal(second.imported.length, 0)
  assert.equal(second.skipped.length, 7)
  assert.equal(uploads, 3)
})
