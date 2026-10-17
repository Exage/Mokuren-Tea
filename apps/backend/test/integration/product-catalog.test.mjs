import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import request from 'supertest'
import { Types } from 'mongoose'
import { authHeaders, createAdmin, seedReferences, startTestApp, stopTestApp } from './setup.mjs'

let app
let replSet
let db
let refs
let adminToken

async function publishTea({
  slug,
  name,
  price,
  weightGrams,
  tastes,
  physicalGrams,
  firstPublishedAt,
}) {
  const created = await request(app.getHttpServer())
    .post('/api/admin/products')
    .set(authHeaders(adminToken))
    .send({
      name,
      slug,
      categoryId: refs.categoryId,
      tasteNoteIds: tastes,
      imageIds: [refs.imageId],
    })
  assert.equal(created.status, 201)
  const id = created.body.id

  const variant = await request(app.getHttpServer())
    .post(`/api/admin/products/${id}/variants`)
    .set(authHeaders(adminToken))
    .send({ weightGrams, price })
  assert.equal(variant.status, 201)

  const published = await request(app.getHttpServer())
    .post(`/api/admin/products/${id}/publish`)
    .set(authHeaders(adminToken))
  assert.equal(published.status, 201)

  await db
    .collection('inventories')
    .updateOne({ productId: new Types.ObjectId(id) }, { $set: { physicalGrams, reservedGrams: 0 } })

  if (firstPublishedAt) {
    await db
      .collection('products')
      .updateOne({ _id: new Types.ObjectId(id) }, { $set: { firstPublishedAt } })
  }

  return id
}

before(async () => {
  const started = await startTestApp('mokuren_catalog_test')
  app = started.app
  replSet = started.replSet
  db = started.db
  refs = await seedReferences(db)
  ;({ token: adminToken } = await createAdmin(db))

  await publishTea({
    slug: 'floral-light',
    name: 'Floral Light',
    price: 10,
    weightGrams: 50,
    tastes: [refs.tasteFloral],
    physicalGrams: 0,
    firstPublishedAt: new Date('2026-01-01T00:00:00.000Z'),
  })
  await publishTea({
    slug: 'creamy-middle',
    name: 'Creamy Middle',
    price: 20,
    weightGrams: 50,
    tastes: [refs.tasteCreamy],
    physicalGrams: 500,
    firstPublishedAt: new Date('2026-02-01T00:00:00.000Z'),
  })
  await publishTea({
    slug: 'floral-creamy-rich',
    name: 'Floral Creamy Rich',
    price: 30,
    weightGrams: 50,
    tastes: [refs.tasteFloral, refs.tasteCreamy],
    physicalGrams: 500,
    firstPublishedAt: new Date('2026-03-01T00:00:00.000Z'),
  })

  const draft = await request(app.getHttpServer())
    .post('/api/admin/products')
    .set(authHeaders(adminToken))
    .send({ name: 'Hidden Draft', slug: 'hidden-draft' })
  assert.equal(draft.status, 201)

  const toArchive = await request(app.getHttpServer())
    .post('/api/admin/products')
    .set(authHeaders(adminToken))
    .send({ name: 'Old Tea', slug: 'old-tea' })
  await request(app.getHttpServer())
    .post(`/api/admin/products/${toArchive.body.id}/archive`)
    .set(authHeaders(adminToken))
    .expect(201)
})

after(async () => {
  await stopTestApp(app, replSet)
})

test('lists only published products with a correct total', async () => {
  const response = await request(app.getHttpServer()).get('/api/products').expect(200)
  assert.equal(response.body.pagination.totalItems, 3)
  assert.equal(response.body.items.length, 3)

  const slugs = response.body.items.map((item) => item.slug)
  assert.ok(!slugs.includes('hidden-draft'))
  assert.ok(!slugs.includes('old-tea'))
})

test('sorts newest first by default with a stable key', async () => {
  const response = await request(app.getHttpServer()).get('/api/products').expect(200)
  assert.deepEqual(
    response.body.items.map((item) => item.slug),
    ['floral-creamy-rich', 'creamy-middle', 'floral-light']
  )
})

test('sorts by minimum variant price without demoting out-of-stock cards', async () => {
  const asc = await request(app.getHttpServer()).get('/api/products?sort=price-asc').expect(200)
  assert.deepEqual(
    asc.body.items.map((item) => item.slug),
    ['floral-light', 'creamy-middle', 'floral-creamy-rich']
  )
  assert.equal(asc.body.items[0].outOfStock, true)

  const desc = await request(app.getHttpServer()).get('/api/products?sort=price-desc').expect(200)
  assert.deepEqual(
    desc.body.items.map((item) => item.slug),
    ['floral-creamy-rich', 'creamy-middle', 'floral-light']
  )
})

test('applies AND semantics for several taste filters', async () => {
  const single = await request(app.getHttpServer())
    .get(`/api/products?tastes=${refs.tasteFloral}`)
    .expect(200)
  assert.equal(single.body.pagination.totalItems, 2)

  const both = await request(app.getHttpServer())
    .get(`/api/products?tastes=${refs.tasteFloral},${refs.tasteCreamy}`)
    .expect(200)
  assert.equal(both.body.pagination.totalItems, 1)
  assert.equal(both.body.items[0].slug, 'floral-creamy-rich')
})

test('filters by minimum variant price and paginates', async () => {
  const filtered = await request(app.getHttpServer())
    .get('/api/products?minPrice=15&maxPrice=25')
    .expect(200)
  assert.equal(filtered.body.pagination.totalItems, 1)
  assert.equal(filtered.body.items[0].slug, 'creamy-middle')

  const firstPage = await request(app.getHttpServer())
    .get('/api/products?limit=2&page=1')
    .expect(200)
  assert.equal(firstPage.body.items.length, 2)
  assert.equal(firstPage.body.pagination.totalItems, 3)
  assert.equal(firstPage.body.pagination.totalPages, 2)

  const secondPage = await request(app.getHttpServer())
    .get('/api/products?limit=2&page=2')
    .expect(200)
  assert.equal(secondPage.body.items.length, 1)
})

test('returns a public card without exact stock counters', async () => {
  const response = await request(app.getHttpServer()).get('/api/products/creamy-middle').expect(200)
  const raw = JSON.stringify(response.body)

  assert.ok(!raw.includes('physicalGrams'))
  assert.ok(!raw.includes('reservedGrams'))
  assert.ok(!raw.includes('availableGrams'))
  assert.equal(response.body.minPrice, 20)
  assert.equal(response.body.outOfStock, false)
  assert.equal(response.body.variants.length, 1)
  assert.equal(response.body.variants[0].available, true)

  const empty = await request(app.getHttpServer()).get('/api/products/floral-light').expect(200)
  assert.equal(empty.body.outOfStock, true)
  assert.equal(empty.body.minPrice, 10)
})

test('hides drafts and archived products from the public card', async () => {
  await request(app.getHttpServer()).get('/api/products/hidden-draft').expect(404)
  await request(app.getHttpServer()).get('/api/products/old-tea').expect(404)
})
