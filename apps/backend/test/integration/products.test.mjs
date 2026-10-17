import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { Types } from 'mongoose'
import request from 'supertest'
import { authHeaders, createAdmin, seedReferences, startTestApp, stopTestApp } from './setup.mjs'

let app
let replSet
let db
let refs
let adminToken

before(async () => {
  const started = await startTestApp('mokuren_products_test')
  app = started.app
  replSet = started.replSet
  db = started.db
  refs = await seedReferences(db)
  ;({ token: adminToken } = await createAdmin(db))
})

after(async () => {
  await stopTestApp(app, replSet)
})

async function createDraft(overrides = {}) {
  const response = await request(app.getHttpServer())
    .post('/api/admin/products')
    .set(authHeaders(adminToken))
    .send({ name: 'Milk Oolong', slug: `milk-oolong-${Date.now()}-${Math.random()}`, ...overrides })

  return response
}

test('creates a draft with zero inventory and an audit entry atomically', async () => {
  const slug = `atomic-${Date.now()}`
  const response = await request(app.getHttpServer())
    .post('/api/admin/products')
    .set(authHeaders(adminToken))
    .send({
      name: 'Atomic Tea',
      slug,
      description: 'Draft body',
      categoryId: refs.categoryId,
      tasteNoteIds: [refs.tasteFloral],
      imageIds: [refs.imageId],
    })

  assert.equal(response.status, 201)
  assert.equal(response.body.status, 'draft')
  assert.equal(response.body.slug, slug)

  const product = await db.collection('products').findOne({ slug })
  assert.ok(product)
  assert.equal(product.status, 'draft')

  const inventory = await db.collection('inventories').findOne({ productId: product._id })
  assert.deepEqual(
    { physicalGrams: inventory.physicalGrams, reservedGrams: inventory.reservedGrams },
    { physicalGrams: 0, reservedGrams: 0 }
  )

  const audit = await db
    .collection('auditlogs')
    .findOne({ action: 'product.created', entityId: String(product._id) })
  assert.ok(audit)
})

test('rejects a duplicate slug with a conflict', async () => {
  const slug = `dupe-${Date.now()}`
  const first = await createDraft({ slug })
  assert.equal(first.status, 201)

  const second = await createDraft({ slug })
  assert.equal(second.status, 409)
  assert.equal(second.body.code || second.body.message?.code, 'CONFLICT')
})

test('rolls back product, inventory and audit when references are invalid', async () => {
  const productsBefore = await db.collection('products').countDocuments()
  const inventoryBefore = await db.collection('inventories').countDocuments()
  const auditBefore = await db.collection('auditlogs').countDocuments()

  const response = await createDraft({
    slug: `badref-${Date.now()}`,
    categoryId: '64f000000000000000000000',
  })
  assert.equal(response.status, 404)

  assert.equal(await db.collection('products').countDocuments(), productsBefore)
  assert.equal(await db.collection('inventories').countDocuments(), inventoryBefore)
  assert.equal(await db.collection('auditlogs').countDocuments(), auditBefore)
})

test('creates a draft with several variants in one request', async () => {
  const slug = `multi-variant-${Date.now()}`
  const response = await request(app.getHttpServer())
    .post('/api/admin/products')
    .set(authHeaders(adminToken))
    .send({
      name: 'Молочный улун',
      slug,
      categoryId: refs.categoryId,
      imageIds: [refs.imageId],
      variants: [
        { weightGrams: 50, price: 21.9, enabled: true },
        { weightGrams: 100, price: 39.9 },
      ],
    })

  assert.equal(response.status, 201)
  assert.equal(response.body.status, 'draft')
  assert.equal(response.body.variants.length, 2)
  assert.deepEqual(
    response.body.variants.map((variant) => ({
      weightGrams: variant.weightGrams,
      price: variant.price,
      enabled: variant.enabled,
    })),
    [
      { weightGrams: 50, price: 21.9, enabled: true },
      { weightGrams: 100, price: 39.9, enabled: true },
    ]
  )

  for (const variant of response.body.variants) {
    assert.ok(typeof variant.variantId === 'string' && variant.variantId.length > 0)
  }

  const product = await db.collection('products').findOne({ slug })
  assert.equal(product.status, 'draft')
  assert.equal(product.variants.length, 2)
  assert.equal(product.variants[0].price._bsontype, 'Decimal128')
  assert.equal(product.variants[0].price.toString(), '21.9')
})

test('creates a draft without variants and allows adding them later', async () => {
  const slug = `no-variant-${Date.now()}`
  const created = await request(app.getHttpServer())
    .post('/api/admin/products')
    .set(authHeaders(adminToken))
    .send({ name: 'Plain Tea', slug, variants: [] })

  assert.equal(created.status, 201)
  assert.equal(created.body.status, 'draft')
  assert.deepEqual(created.body.variants, [])

  const id = created.body.id
  const added = await request(app.getHttpServer())
    .post(`/api/admin/products/${id}/variants`)
    .set(authHeaders(adminToken))
    .send({ weightGrams: 50, price: 21.9 })
  assert.equal(added.status, 201)
  assert.equal(added.body.variants.length, 1)
})

test('rejects an invalid variant without creating the product', async () => {
  const slug = `bad-variant-${Date.now()}`
  const response = await request(app.getHttpServer())
    .post('/api/admin/products')
    .set(authHeaders(adminToken))
    .send({
      name: 'Broken Tea',
      slug,
      variants: [{ weightGrams: 0, price: 21.9 }],
    })

  assert.equal(response.status, 400)
  const product = await db.collection('products').findOne({ slug })
  assert.equal(product, null)
})

test('rejects duplicate variant weights within one create request', async () => {
  const slug = `dupe-variant-${Date.now()}`
  const response = await request(app.getHttpServer())
    .post('/api/admin/products')
    .set(authHeaders(adminToken))
    .send({
      name: 'Duplicate Tea',
      slug,
      variants: [
        { weightGrams: 50, price: 21.9 },
        { weightGrams: 50, price: 39.9 },
      ],
    })

  assert.equal(response.status, 409)
  const product = await db.collection('products').findOne({ slug })
  assert.equal(product, null)
})

test('keeps variant identifiers stable across edits and forbids duplicate weights', async () => {
  const created = await createDraft({ slug: `variants-${Date.now()}` })
  const id = created.body.id

  const added = await request(app.getHttpServer())
    .post(`/api/admin/products/${id}/variants`)
    .set(authHeaders(adminToken))
    .send({ weightGrams: 50, price: 21.9 })
  assert.equal(added.status, 201)
  assert.equal(added.body.variants.length, 1)
  const variantId = added.body.variants[0].variantId
  assert.ok(typeof variantId === 'string' && variantId.length > 0)

  const duplicate = await request(app.getHttpServer())
    .post(`/api/admin/products/${id}/variants`)
    .set(authHeaders(adminToken))
    .send({ weightGrams: 50, price: 29.9 })
  assert.equal(duplicate.status, 409)

  const updated = await request(app.getHttpServer())
    .patch(`/api/admin/products/${id}/variants/${variantId}`)
    .set(authHeaders(adminToken))
    .send({ price: 24.9, enabled: false })
  assert.equal(updated.status, 200)
  assert.equal(updated.body.variants[0].variantId, variantId)
  assert.equal(updated.body.variants[0].price, 24.9)
  assert.equal(updated.body.variants[0].enabled, false)
})

test('accepts a BYN decimal price and stores it as Decimal128', async () => {
  const created = await createDraft({ slug: `decimal-price-${Date.now()}` })
  const id = created.body.id

  const added = await request(app.getHttpServer())
    .post(`/api/admin/products/${id}/variants`)
    .set(authHeaders(adminToken))
    .set('Content-Type', 'application/json')
    .send('{"weightGrams":50,"price":21.90}')
    .expect(201)

  assert.equal(added.body.variants[0].price, 21.9)

  const product = await db.collection('products').findOne({ _id: new Types.ObjectId(id) })
  assert.equal(product.variants[0].price._bsontype, 'Decimal128')
  assert.equal(product.variants[0].price.toString(), '21.9')
})

test('publishes only when ready and archives terminally', async () => {
  const created = await createDraft({ slug: `lifecycle-${Date.now()}` })
  const id = created.body.id

  const early = await request(app.getHttpServer())
    .post(`/api/admin/products/${id}/publish`)
    .set(authHeaders(adminToken))
  assert.equal(early.status, 409)

  await request(app.getHttpServer())
    .patch(`/api/admin/products/${id}`)
    .set(authHeaders(adminToken))
    .send({ categoryId: refs.categoryId, imageIds: [refs.imageId] })
    .expect(200)
  await request(app.getHttpServer())
    .post(`/api/admin/products/${id}/variants`)
    .set(authHeaders(adminToken))
    .send({ weightGrams: 50, price: 21.9 })
    .expect(201)

  const published = await request(app.getHttpServer())
    .post(`/api/admin/products/${id}/publish`)
    .set(authHeaders(adminToken))
  assert.equal(published.status, 201)
  assert.equal(published.body.status, 'published')
  assert.ok(published.body.firstPublishedAt)
  const firstPublishedAt = published.body.firstPublishedAt

  const republished = await request(app.getHttpServer())
    .post(`/api/admin/products/${id}/publish`)
    .set(authHeaders(adminToken))
  assert.equal(republished.body.firstPublishedAt, firstPublishedAt)

  const archived = await request(app.getHttpServer())
    .post(`/api/admin/products/${id}/archive`)
    .set(authHeaders(adminToken))
  assert.equal(archived.status, 201)
  assert.equal(archived.body.status, 'archived')

  const publishArchived = await request(app.getHttpServer())
    .post(`/api/admin/products/${id}/publish`)
    .set(authHeaders(adminToken))
  assert.equal(publishArchived.status, 409)
})

test('rejects unauthenticated admin access and password-change accounts', async () => {
  await request(app.getHttpServer()).get('/api/admin/products').expect(401)

  const expired = await createAdmin(db, { expiresAt: new Date(Date.now() - 1000) })
  await request(app.getHttpServer())
    .get('/api/admin/products')
    .set(authHeaders(expired.token))
    .expect(401)

  const mustChange = await createAdmin(db, { mustChangePassword: true })
  const forbidden = await request(app.getHttpServer())
    .get('/api/admin/products')
    .set(authHeaders(mustChange.token))
  assert.equal(forbidden.status, 403)
})

test('exposes an administrative card with stock levels', async () => {
  const created = await createDraft({ slug: `card-${Date.now()}` })
  const card = await request(app.getHttpServer())
    .get(`/api/admin/products/${created.body.id}`)
    .set(authHeaders(adminToken))
    .expect(200)

  assert.deepEqual(card.body.stock, { physicalGrams: 0, reservedGrams: 0, availableGrams: 0 })
})
