import assert from 'node:assert/strict'
import { after, afterEach, before, test } from 'node:test'
import request from 'supertest'
import { authHeaders, createAdmin, seedReferences, startTestApp, stopTestApp } from './setup.mjs'

let app
let replSet
let db
let adminToken
let refs

before(async () => {
  const started = await startTestApp('mokuren_categories_public_test')
  app = started.app
  replSet = started.replSet
  db = started.db
  ;({ token: adminToken } = await createAdmin(db))
  refs = await seedReferences(db)
})

afterEach(async () => {
  await db.collection('categories').deleteMany({})
  await db.collection('products').deleteMany({})
  await db.collection('auditlogs').deleteMany({})
})

after(async () => {
  await stopTestApp(app, replSet)
})

async function createCategory(body) {
  const response = await request(app.getHttpServer())
    .post('/api/admin/categories')
    .set(authHeaders(adminToken))
    .send(body)
  assert.equal(response.status, 201)
  return response.body
}

async function createProductInCategory(categoryId, overrides = {}) {
  const slug = `prod-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const response = await request(app.getHttpServer())
    .post('/api/admin/products')
    .set(authHeaders(adminToken))
    .send({
      name: 'Test Product',
      slug,
      categoryId,
      imageIds: [refs.imageId],
      variants: [{ weightGrams: 50, price: 21.9, enabled: true }],
      ...overrides,
    })
  assert.equal(response.status, 201)
  return response.body
}

async function publishProduct(id) {
  const response = await request(app.getHttpServer())
    .post(`/api/admin/products/${id}/publish`)
    .set(authHeaders(adminToken))
  assert.equal(response.status, 201)
  return response.body
}

test('public list works without a session and is empty when nothing is published', async () => {
  await createCategory({ name: 'Empty', slug: 'empty-cat' })

  const response = await request(app.getHttpServer()).get('/api/categories')

  assert.equal(response.status, 200)
  assert.deepEqual(response.body, { items: [] })

  for (const field of ['referenceRevision', '__v']) {
    assert.ok(!JSON.stringify(response.body).includes(field), `expected ${field} to be excluded`)
  }
})

test('public list includes only categories with at least one published product', async () => {
  const publishedCat = await createCategory({ name: 'Published Cat', slug: 'published-cat' })
  const draftCat = await createCategory({ name: 'Draft Cat', slug: 'draft-cat' })

  const publishedProduct = await createProductInCategory(publishedCat.id)
  await publishProduct(publishedProduct.id)

  await createProductInCategory(draftCat.id)

  const response = await request(app.getHttpServer()).get('/api/categories')

  assert.equal(response.status, 200)
  assert.equal(response.body.items.length, 1)
  assert.equal(response.body.items[0].slug, 'published-cat')
  assert.deepEqual(response.body.items[0], {
    id: publishedCat.id,
    name: 'Published Cat',
    slug: 'published-cat',
    sortOrder: 0,
  })
})

test('a published product makes its category visible even with no available stock', async () => {
  const cat = await createCategory({ name: 'No Stock', slug: 'no-stock' })
  const product = await createProductInCategory(cat.id)
  await publishProduct(product.id)

  const response = await request(app.getHttpServer()).get('/api/categories')

  assert.equal(response.status, 200)
  assert.equal(response.body.items.length, 1)
  assert.equal(response.body.items[0].id, cat.id)
})

test('archiving the last published product removes its category from public reads', async () => {
  const cat = await createCategory({ name: 'Archiving', slug: 'archiving' })
  const product = await createProductInCategory(cat.id)
  await publishProduct(product.id)

  let response = await request(app.getHttpServer()).get('/api/categories')
  assert.equal(response.body.items.length, 1)

  await request(app.getHttpServer())
    .post(`/api/admin/products/${product.id}/archive`)
    .set(authHeaders(adminToken))

  response = await request(app.getHttpServer()).get('/api/categories')
  assert.equal(response.body.items.length, 0)
})

test('admin paginated list returns all categories with productsCount across statuses', async () => {
  const catA = await createCategory({ name: 'A', slug: 'cat-a', sortOrder: 10 })
  const catB = await createCategory({ name: 'B', slug: 'cat-b', sortOrder: 5 })

  const publishedA = await createProductInCategory(catA.id)
  await publishProduct(publishedA.id)
  await createProductInCategory(catA.id) // draft sibling
  const archivedB = await createProductInCategory(catB.id)
  await request(app.getHttpServer())
    .post(`/api/admin/products/${archivedB.id}/archive`)
    .set(authHeaders(adminToken))

  const response = await request(app.getHttpServer())
    .get('/api/admin/categories')
    .set(authHeaders(adminToken))

  assert.equal(response.status, 200)
  assert.equal(response.body.items.length, 2)
  assert.equal(response.body.items[0].slug, 'cat-b')
  assert.equal(response.body.items[0].productsCount, 1)
  assert.equal(response.body.items[1].slug, 'cat-a')
  assert.equal(response.body.items[1].productsCount, 2)
  assert.deepEqual(response.body.pagination, {
    page: 1,
    limit: 20,
    totalItems: 2,
    totalPages: 1,
  })
})

test('admin search treats regex metacharacters literally', async () => {
  await createCategory({ name: 'dXot', slug: 'dxot' })
  await createCategory({ name: 'D.ot', slug: 'dot' })

  const response = await request(app.getHttpServer())
    .get('/api/admin/categories')
    .set(authHeaders(adminToken))
    .query({ search: 'd.ot' })

  assert.equal(response.status, 200)
  assert.equal(response.body.items.length, 1)
  assert.equal(response.body.items[0].slug, 'dot')
})

test('admin rejects a limit above the maximum', async () => {
  await createCategory({ name: 'C', slug: 'c' })

  const response = await request(app.getHttpServer())
    .get('/api/admin/categories')
    .set(authHeaders(adminToken))
    .query({ limit: 200 })

  assert.equal(response.status, 400)
})

test('admin category response does not leak internal fields', async () => {
  const cat = await createCategory({ name: 'Leak', slug: 'leak' })

  const response = await request(app.getHttpServer())
    .get('/api/admin/categories')
    .set(authHeaders(adminToken))

  const item = response.body.items.find((i) => i.id === cat.id)
  assert.ok(item)
  assert.ok(!('referenceRevision' in item))
  assert.ok(!('__v' in item))
  assert.ok(typeof item.createdAt === 'string')
  assert.ok(typeof item.updatedAt === 'string')
})
