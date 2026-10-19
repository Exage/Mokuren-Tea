import assert from 'node:assert/strict'
import { after, afterEach, before, test } from 'node:test'
import { Types } from 'mongoose'
import request from 'supertest'
import { authHeaders, createAdmin, seedReferences, startTestApp, stopTestApp } from './setup.mjs'

let app
let replSet
let db
let adminToken
let refs

before(async () => {
  const started = await startTestApp('mokuren_categories_concurrency_test')
  app = started.app
  replSet = started.replSet
  db = started.db
  ;({ token: adminToken } = await createAdmin(db))
  refs = await seedReferences(db)
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

async function moveAndDelete(sourceId, body = {}) {
  return request(app.getHttpServer())
    .post(`/api/admin/categories/${sourceId}/move-and-delete`)
    .set(authHeaders(adminToken))
    .send(body)
}

afterEach(async () => {
  await db.collection('categories').deleteMany({})
  await db.collection('products').deleteMany({})
  await db.collection('auditlogs').deleteMany({})
})

test('two concurrent creates with normalized-equivalent slugs: one wins, one conflicts', async () => {
  const results = await Promise.all([
    request(app.getHttpServer())
      .post('/api/admin/categories')
      .set(authHeaders(adminToken))
      .send({ name: 'Race', slug: '  RACE  ' }),
    request(app.getHttpServer())
      .post('/api/admin/categories')
      .set(authHeaders(adminToken))
      .send({ name: 'Race', slug: 'race' }),
  ])

  const statuses = results.map((r) => r.status).sort()
  assert.deepEqual(statuses, [201, 409])

  const count = await db.collection('categories').countDocuments({ slug: 'race' })
  assert.equal(count, 1)

  const auditCount = await db.collection('auditlogs').countDocuments({
    action: 'category.created',
    entityType: 'category',
  })
  assert.equal(auditCount, 1)
})

test('two concurrent deletions of the same source: one wins, one gets 404', async () => {
  const cat = await createCategory({ name: 'Gone', slug: 'gone' })

  const results = await Promise.all([
    moveAndDelete(cat.id, {}),
    moveAndDelete(cat.id, {}),
  ])

  const statuses = results.map((r) => r.status).sort()
  assert.deepEqual(statuses, [200, 404])

  assert.equal(await db.collection('categories').countDocuments({ _id: new Types.ObjectId(cat.id) }), 0)
  const deletedAudits = await db.collection('auditlogs').countDocuments({
    action: 'category.deleted',
    entityType: 'category',
    entityId: cat.id,
  })
  assert.equal(deletedAudits, 1)
})

test('two concurrent PATCHes attempting the same slug: unique index holds, one conflicts', async () => {
  const first = await createCategory({ name: 'First', slug: 'first' })
  const second = await createCategory({ name: 'Second', slug: 'second' })

  const sharedSlug = `shared-${Date.now()}`

  const results = await Promise.all([
    request(app.getHttpServer())
      .patch(`/api/admin/categories/${first.id}`)
      .set(authHeaders(adminToken))
      .send({ slug: sharedSlug }),
    request(app.getHttpServer())
      .patch(`/api/admin/categories/${second.id}`)
      .set(authHeaders(adminToken))
      .send({ slug: sharedSlug }),
  ])

  const statuses = results.map((r) => r.status).sort()
  assert.deepEqual(statuses, [200, 409])

  const count = await db.collection('categories').countDocuments({ slug: sharedSlug })
  assert.equal(count, 1)
})

test('concurrent product creation into an empty category versus its deletion leaves no dangling refs', async () => {
  const cat = await createCategory({ name: 'Race', slug: 'race' })

  const results = await Promise.all([
    request(app.getHttpServer())
      .post('/api/admin/products')
      .set(authHeaders(adminToken))
      .send({
        name: 'Test Product',
        slug: `prod-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        categoryId: cat.id,
        imageIds: [refs.imageId],
        variants: [{ weightGrams: 50, price: 21.9, enabled: true }],
      }),
    moveAndDelete(cat.id, {}),
  ])

  const productStatus = results[0].status

  const remainingRefs = await db.collection('products').countDocuments({
    categoryId: new Types.ObjectId(cat.id),
  })

  const categoryStillExists = await db.collection('categories').countDocuments({
    _id: new Types.ObjectId(cat.id),
  })

  // Exactly one ordering can commit. Either the product was created against a
  // live category, or the category was deleted and the product creation failed.
  if (categoryStillExists === 1) {
    assert.equal(productStatus, 201)
    assert.equal(remainingRefs, 1)
  } else {
    assert.equal(categoryStillExists, 0)
    assert.equal(remainingRefs, 0)
  }
})
