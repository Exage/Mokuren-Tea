import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { after, before, test } from 'node:test'
import { Types } from 'mongoose'
import request from 'supertest'
import { authHeaders, createAdmin, seedReferences, startTestApp, stopTestApp } from './setup.mjs'

let app
let replSet
let db
let refs
let adminToken
let fake
let service

function jpegBuffer(size = 1024) {
  const buffer = Buffer.alloc(size)
  buffer[0] = 0xff
  buffer[1] = 0xd8
  buffer[2] = 0xff
  return buffer
}

function createFakeCloudinary() {
  const store = new Map()
  const state = { failUpload: false, failDestroy: false, destroyCalls: [] }

  return {
    state,
    store,
    isConfigured: () => true,
    buildPublicId: (assetId) => `mokuren-tea/test/${assetId}`,
    uploadImage: async (buffer, publicId) => {
      if (state.failUpload) {
        state.failUpload = false
        throw new Error('cloudinary unavailable')
      }

      const resource = {
        assetId: `fake-${publicId}`,
        publicId,
        version: 1,
        secureUrl: `https://res.cloudinary.com/fake/image/upload/${publicId}.jpg`,
        format: 'jpg',
        bytes: buffer.length,
        width: 800,
        height: 600,
      }
      store.set(publicId, resource)
      return resource
    },
    destroyImage: async (publicId) => {
      state.destroyCalls.push(publicId)

      if (state.failDestroy) {
        state.failDestroy = false
        throw new Error('destroy failed')
      }

      store.delete(publicId)
    },
    fetchResource: async (publicId) => store.get(publicId) || null,
  }
}

async function uploadImage(filename = 'photo.jpg', alt = 'Tea photo', size = 1024) {
  const response = await request(app.getHttpServer())
    .post('/api/admin/media-assets')
    .set(authHeaders(adminToken))
    .field('alt', alt)
    .attach('file', jpegBuffer(size), filename)
  return response
}

async function createDraft(slug, imageIds = []) {
  const response = await request(app.getHttpServer())
    .post('/api/admin/products')
    .set(authHeaders(adminToken))
    .send({ name: `Tea ${slug}`, slug, ...(imageIds.length > 0 ? { imageIds } : {}) })
  return response
}

before(async () => {
  fake = createFakeCloudinary()
  const started = await startTestApp('mokuren_media_test', { cloudinary: fake })
  app = started.app
  replSet = started.replSet
  db = started.db
  refs = await seedReferences(db)
  ;({ token: adminToken } = await createAdmin(db))

  const { MediaAssetsService } = await import('../../dist/media-assets/media-assets.service.js')
  service = app.get(MediaAssetsService)
})

after(async () => {
  await stopTestApp(app, replSet)
})

test('uploads an image and returns 201 with ready metadata', async () => {
  const response = await uploadImage('oolong-fresh.jpg', 'Fresh oolong')

  assert.equal(response.status, 201)
  assert.equal(response.body.status, 'ready')
  assert.equal(response.body.kind, 'image')
  assert.equal(response.body.name, 'oolong-fresh.jpg')
  assert.ok(response.body.url.startsWith('https://'))
  assert.equal(response.body.alt, 'Fresh oolong')
  assert.equal(response.body.width, 800)
  assert.equal(response.body.height, 600)
  assert.equal(response.body.usageCount, 0)
  assert.ok(!('cloudinaryAssetId' in response.body))
  assert.ok(!JSON.stringify(response.body).includes('SECRET'))

  const fetched = await request(app.getHttpServer())
    .get(`/api/admin/media-assets/${response.body.id}`)
    .set(authHeaders(adminToken))
    .expect(200)
  assert.equal(fetched.body.id, response.body.id)

  const audit = await db
    .collection('auditlogs')
    .findOne({ action: 'media-asset.uploaded', entityId: response.body.id })
  assert.ok(audit)
})

test('rejects unsupported formats with 415 and oversized files with 413', async () => {
  const bad = await request(app.getHttpServer())
    .post('/api/admin/media-assets')
    .set(authHeaders(adminToken))
    .attach('file', Buffer.from('hello, not an image'), 'note.txt')
  assert.equal(bad.status, 415)

  const big = await request(app.getHttpServer())
    .post('/api/admin/media-assets')
    .set(authHeaders(adminToken))
    .attach('file', jpegBuffer(10 * 1024 * 1024 + 100), 'huge.jpg')
  assert.equal(big.status, 413)
})

test('rejects unauthenticated media access', async () => {
  await request(app.getHttpServer()).get('/api/admin/media-assets').expect(401)
  await request(app.getHttpServer())
    .post('/api/admin/media-assets')
    .attach('file', jpegBuffer(64), 'photo.jpg')
    .expect(401)
})

test('records a failed upload when Cloudinary is unavailable', async () => {
  fake.state.failUpload = true
  const response = await uploadImage('fail.jpg', 'Will fail')

  assert.equal(response.status, 503)

  const failed = await db
    .collection('mediaassets')
    .find({ status: 'failed' })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray()
  assert.ok(failed.length === 1)

  const list = await request(app.getHttpServer())
    .get('/api/admin/media-assets')
    .set(authHeaders(adminToken))
    .expect(200)
  assert.ok(!list.body.items.some((item) => item.status === 'failed'))

  const onlyFailed = await request(app.getHttpServer())
    .get('/api/admin/media-assets?status=failed')
    .set(authHeaders(adminToken))
    .expect(200)
  assert.ok(onlyFailed.body.items.length >= 1)
})

test('edits alt text and searches the library', async () => {
  const uploaded = await uploadImage('searchable.jpg', 'Original alt')
  assert.equal(uploaded.status, 201)
  const id = uploaded.body.id

  const patched = await request(app.getHttpServer())
    .patch(`/api/admin/media-assets/${id}`)
    .set(authHeaders(adminToken))
    .send({ alt: 'Updated alt text' })
    .expect(200)
  assert.equal(patched.body.alt, 'Updated alt text')

  const found = await request(app.getHttpServer())
    .get('/api/admin/media-assets?search=searchable')
    .set(authHeaders(adminToken))
    .expect(200)
  assert.ok(found.body.items.some((item) => item.id === id))
})

test('stores, edits and searches a media name while preserving alt text', async () => {
  const uploaded = await request(app.getHttpServer())
    .post('/api/admin/media-assets')
    .set(authHeaders(adminToken))
    .field('name', 'Tea leaves')
    .field('alt', 'A bowl of tea')
    .attach('file', jpegBuffer(), 'leaves.jpg')
    .expect(201)
  assert.equal(uploaded.body.name, 'Tea leaves')
  const id = uploaded.body.id
  const stored = await db.collection('mediaassets').findOne({ _id: new Types.ObjectId(id) })
  assert.equal(stored.name, 'Tea leaves')

  const patched = await request(app.getHttpServer())
    .patch(`/api/admin/media-assets/${id}`)
    .set(authHeaders(adminToken))
    .send({ name: 'Fresh oolong' })
    .expect(200)
  assert.equal(patched.body.name, 'Fresh oolong')
  assert.equal(patched.body.alt, 'A bowl of tea')

  const found = await request(app.getHttpServer())
    .get('/api/admin/media-assets?search=Fresh%20oolong')
    .set(authHeaders(adminToken))
    .expect(200)
  assert.ok(found.body.items.some((item) => item.id === id))

  await request(app.getHttpServer())
    .patch(`/api/admin/media-assets/${id}`)
    .set(authHeaders(adminToken))
    .send({ name: '   ' })
    .expect(400)

})

test('binds assets preserving order and rejects duplicates or non-ready links', async () => {
  const first = await uploadImage('bind-a.jpg', 'A')
  const second = await uploadImage('bind-b.jpg', 'B')
  const a = first.body.id
  const b = second.body.id

  const created = await createDraft(`bind-${Date.now()}`, [a, b])
  assert.equal(created.status, 201)
  assert.deepEqual(created.body.imageIds, [a, b])
  assert.deepEqual(
    created.body.images.map((image) => image.id),
    [a, b],
  )
  assert.ok(created.body.images[0].width > 0)

  const afterBind = await db.collection('mediaassets').findOne({ _id: new Types.ObjectId(a) })
  assert.equal(afterBind.usageCount, 1)

  const reordered = await request(app.getHttpServer())
    .patch(`/api/admin/products/${created.body.id}`)
    .set(authHeaders(adminToken))
    .send({ imageIds: [b, a] })
    .expect(200)
  assert.deepEqual(reordered.body.imageIds, [b, a])
  assert.deepEqual(
    reordered.body.images.map((image) => image.id),
    [b, a],
  )

  const still = await db.collection('mediaassets').findOne({ _id: new Types.ObjectId(a) })
  assert.equal(still.usageCount, 1)

  const duplicate = await request(app.getHttpServer())
    .patch(`/api/admin/products/${created.body.id}`)
    .set(authHeaders(adminToken))
    .send({ imageIds: [a, a] })
  assert.equal(duplicate.status, 400)

  const failedId = new Types.ObjectId()
  await db.collection('mediaassets').insertOne({
    _id: failedId,
    kind: 'image',
    status: 'failed',
    cloudinaryAssetId: null,
    publicId: `mokuren-tea/test/${String(failedId)}`,
    version: null,
    secureUrl: null,
    originalName: 'broken.jpg',
    format: null,
    mimeType: null,
    sizeBytes: 10,
    width: null,
    height: null,
    alt: '',
    usageCount: 0,
    createdBy: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  const bindFailed = await request(app.getHttpServer())
    .patch(`/api/admin/products/${created.body.id}`)
    .set(authHeaders(adminToken))
    .send({ imageIds: [String(failedId)] })
  assert.equal(bindFailed.status, 409)

  const missing = await request(app.getHttpServer())
    .patch(`/api/admin/products/${created.body.id}`)
    .set(authHeaders(adminToken))
    .send({ imageIds: ['64f000000000000000000000'] })
  assert.equal(missing.status, 404)
})

test('requires a ready image for publication and keeps the last image of published cards', async () => {
  const draft = await createDraft(`publish-${Date.now()}`)
  assert.equal(draft.status, 201)
  const id = draft.body.id

  await request(app.getHttpServer())
    .patch(`/api/admin/products/${id}`)
    .set(authHeaders(adminToken))
    .send({ categoryId: refs.categoryId })
    .expect(200)
  await request(app.getHttpServer())
    .post(`/api/admin/products/${id}/variants`)
    .set(authHeaders(adminToken))
    .send({ weightGrams: 50, price: 21.9 })
    .expect(201)

  const early = await request(app.getHttpServer())
    .post(`/api/admin/products/${id}/publish`)
    .set(authHeaders(adminToken))
  assert.equal(early.status, 409)

  const uploaded = await uploadImage('publish-ready.jpg', 'Ready')
  await request(app.getHttpServer())
    .patch(`/api/admin/products/${id}`)
    .set(authHeaders(adminToken))
    .send({ imageIds: [uploaded.body.id] })
    .expect(200)

  const published = await request(app.getHttpServer())
    .post(`/api/admin/products/${id}/publish`)
    .set(authHeaders(adminToken))
  assert.equal(published.status, 201)
  assert.equal(published.body.status, 'published')

  const cleared = await request(app.getHttpServer())
    .patch(`/api/admin/products/${id}`)
    .set(authHeaders(adminToken))
    .send({ imageIds: [] })
  assert.equal(cleared.status, 409)
})

test('shares one asset across products and blocks deletion while used', async () => {
  const uploaded = await uploadImage('shared.jpg', 'Shared')
  const shared = uploaded.body.id

  const one = await createDraft(`shared-one-${Date.now()}`, [shared])
  assert.equal(one.status, 201)
  const two = await createDraft(`shared-two-${Date.now()}`, [shared])
  assert.equal(two.status, 201)

  const asset = await request(app.getHttpServer())
    .get(`/api/admin/media-assets/${shared}`)
    .set(authHeaders(adminToken))
    .expect(200)
  assert.equal(asset.body.usageCount, 2)

  const usages = await request(app.getHttpServer())
    .get(`/api/admin/media-assets/${shared}/usages`)
    .set(authHeaders(adminToken))
    .expect(200)
  assert.equal(usages.body.length, 2)

  const blocked = await request(app.getHttpServer())
    .delete(`/api/admin/media-assets/${shared}`)
    .set(authHeaders(adminToken))
  assert.equal(blocked.status, 409)
  assert.equal(blocked.body.code || blocked.body.message?.code, 'MEDIA_ASSET_IN_USE')

  await request(app.getHttpServer())
    .patch(`/api/admin/products/${one.body.id}`)
    .set(authHeaders(adminToken))
    .send({ imageIds: [] })
    .expect(200)

  const afterOne = await request(app.getHttpServer())
    .get(`/api/admin/media-assets/${shared}`)
    .set(authHeaders(adminToken))
    .expect(200)
  assert.equal(afterOne.body.usageCount, 1)

  await request(app.getHttpServer())
    .patch(`/api/admin/products/${two.body.id}`)
    .set(authHeaders(adminToken))
    .send({ imageIds: [] })
    .expect(200)

  const removed = await request(app.getHttpServer())
    .delete(`/api/admin/media-assets/${shared}`)
    .set(authHeaders(adminToken))
  assert.equal(removed.status, 202)

  const final = await request(app.getHttpServer())
    .get(`/api/admin/media-assets/${shared}`)
    .set(authHeaders(adminToken))
    .expect(200)
  assert.ok(['deleting', 'deleted'].includes(final.body.status))

  const repeat = await request(app.getHttpServer())
    .delete(`/api/admin/media-assets/${shared}`)
    .set(authHeaders(adminToken))
  assert.ok([200, 202].includes(repeat.status))

  const starts = await db
    .collection('auditlogs')
    .countDocuments({ action: 'media-asset.delete-started', entityId: shared })
  assert.equal(starts, 1)
})

test('retries deletion after a Cloudinary failure', async () => {
  const uploaded = await uploadImage('retry-delete.jpg', 'Retry')
  const id = uploaded.body.id

  fake.state.failDestroy = true
  const first = await request(app.getHttpServer())
    .delete(`/api/admin/media-assets/${id}`)
    .set(authHeaders(adminToken))
  assert.equal(first.status, 503)

  const stuck = await request(app.getHttpServer())
    .get(`/api/admin/media-assets/${id}`)
    .set(authHeaders(adminToken))
    .expect(200)
  assert.equal(stuck.body.status, 'deleting')

  const second = await request(app.getHttpServer())
    .delete(`/api/admin/media-assets/${id}`)
    .set(authHeaders(adminToken))
  assert.equal(second.status, 202)
  assert.equal(second.body.status, 'deleted')
})

test('keeps concurrent bind and delete consistent', async () => {
  const uploaded = await uploadImage('race.jpg', 'Race')
  const assetId = uploaded.body.id
  const draft = await createDraft(`race-${Date.now()}`)
  const productId = draft.body.id

  const [bound, removed] = await Promise.all([
    request(app.getHttpServer())
      .patch(`/api/admin/products/${productId}`)
      .set(authHeaders(adminToken))
      .send({ imageIds: [assetId] }),
    request(app.getHttpServer()).delete(`/api/admin/media-assets/${assetId}`).set(authHeaders(adminToken)),
  ])

  const statuses = [bound.status, removed.status].sort()
  assert.ok(statuses.includes(409))

  const product = await db.collection('products').findOne({ _id: new Types.ObjectId(productId) })
  const asset = await db.collection('mediaassets').findOne({ _id: new Types.ObjectId(assetId) })
  const linked = (product.imageIds || []).map(String).includes(assetId)

  if (linked) {
    assert.equal(removed.status, 409)
    assert.equal(asset.status, 'ready')
    assert.ok(asset.usageCount >= 1)
  } else {
    assert.equal(bound.status, 409)
    assert.ok(['deleting', 'deleted'].includes(asset.status))
  }
})

test('reconciles stuck uploads and unfinished deletions', async () => {
  const orphanId = new Types.ObjectId()
  const orphanPublicId = `mokuren-tea/test/${String(orphanId)}`
  fake.store.set(orphanPublicId, {
    assetId: `fake-${orphanPublicId}`,
    publicId: orphanPublicId,
    version: 3,
    secureUrl: `https://res.cloudinary.com/fake/image/upload/${orphanPublicId}.jpg`,
    format: 'jpg',
    bytes: 500,
    width: 640,
    height: 480,
  })
  await db.collection('mediaassets').insertOne({
    _id: orphanId,
    kind: 'image',
    status: 'uploading',
    cloudinaryAssetId: null,
    publicId: orphanPublicId,
    version: null,
    secureUrl: null,
    originalName: 'orphan.jpg',
    format: null,
    mimeType: null,
    sizeBytes: 500,
    width: null,
    height: null,
    alt: '',
    usageCount: 0,
    createdBy: null,
    deletedAt: null,
    createdAt: new Date(Date.now() - 2 * 3600 * 1000),
    updatedAt: new Date(Date.now() - 2 * 3600 * 1000),
  })

  const lostId = new Types.ObjectId()
  await db.collection('mediaassets').insertOne({
    _id: lostId,
    kind: 'image',
    status: 'uploading',
    cloudinaryAssetId: null,
    publicId: `mokuren-tea/test/${String(lostId)}`,
    version: null,
    secureUrl: null,
    originalName: 'lost.jpg',
    format: null,
    mimeType: null,
    sizeBytes: 500,
    width: null,
    height: null,
    alt: '',
    usageCount: 0,
    createdBy: null,
    deletedAt: null,
    createdAt: new Date(Date.now() - 2 * 3600 * 1000),
    updatedAt: new Date(Date.now() - 2 * 3600 * 1000),
  })

  const deletingId = new Types.ObjectId()
  const deletingPublicId = `mokuren-tea/test/${String(deletingId)}`
  fake.store.set(deletingPublicId, {
    assetId: `fake-${deletingPublicId}`,
    publicId: deletingPublicId,
    version: 1,
    secureUrl: `https://res.cloudinary.com/fake/image/upload/${deletingPublicId}.jpg`,
    format: 'jpg',
    bytes: 500,
    width: 100,
    height: 100,
  })
  await db.collection('mediaassets').insertOne({
    _id: deletingId,
    kind: 'image',
    status: 'deleting',
    cloudinaryAssetId: `fake-${deletingPublicId}`,
    publicId: deletingPublicId,
    version: 1,
    secureUrl: `https://res.cloudinary.com/fake/image/upload/${deletingPublicId}.jpg`,
    originalName: 'stuck-delete.jpg',
    format: 'jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 500,
    width: 100,
    height: 100,
    alt: '',
    usageCount: 0,
    createdBy: null,
    deletedAt: null,
    createdAt: new Date(Date.now() - 2 * 3600 * 1000),
    updatedAt: new Date(Date.now() - 2 * 3600 * 1000),
  })

  const summary = await service.reconcileStuck()
  assert.ok(summary.adoptedUploads >= 1)
  assert.ok(summary.failedUploads >= 1)
  assert.ok(summary.finishedDeletions >= 1)

  const adopted = await db.collection('mediaassets').findOne({ _id: orphanId })
  assert.equal(adopted.status, 'ready')
  assert.ok(adopted.secureUrl.startsWith('https://'))

  const failed = await db.collection('mediaassets').findOne({ _id: lostId })
  assert.equal(failed.status, 'failed')

  const finished = await db.collection('mediaassets').findOne({ _id: deletingId })
  assert.equal(finished.status, 'deleted')
})

test('returns optimized batch image URLs in the public catalog', async () => {
  const uploaded = await uploadImage('catalog.jpg', 'Catalog tea')
  const imageId = uploaded.body.id

  const created = await createDraft(`catalog-${Date.now()}`, [imageId])
  assert.equal(created.status, 201)
  const productId = created.body.id

  await request(app.getHttpServer())
    .patch(`/api/admin/products/${productId}`)
    .set(authHeaders(adminToken))
    .send({ categoryId: refs.categoryId })
    .expect(200)
  await request(app.getHttpServer())
    .post(`/api/admin/products/${productId}/variants`)
    .set(authHeaders(adminToken))
    .send({ weightGrams: 50, price: 15.5 })
    .expect(201)
  await request(app.getHttpServer())
    .post(`/api/admin/products/${productId}/publish`)
    .set(authHeaders(adminToken))
    .expect(201)

  const createdDoc = await db.collection('products').findOne({ _id: new Types.ObjectId(productId) })
  const slug = createdDoc.slug

  const list = await request(app.getHttpServer()).get('/api/products?limit=100').expect(200)
  const entry = list.body.items.find((item) => item.slug === slug)
  assert.ok(entry)
  assert.equal(entry.images.length, 1)
  assert.ok(entry.images[0].url.includes('f_auto,q_auto'))
  assert.equal(entry.images[0].width, 800)
  assert.equal(entry.images[0].height, 600)

  const card = await request(app.getHttpServer()).get(`/api/products/${slug}`).expect(200)
  assert.equal(card.body.images.length, 1)
  assert.ok(card.body.images[0].url.includes('f_auto,q_auto'))
  assert.ok(card.body.images[0].url.includes('w_1600'))
})
