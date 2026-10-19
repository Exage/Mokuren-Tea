import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { Types } from 'mongoose'
import request from 'supertest'
import { authHeaders, createAdmin, startTestApp, stopTestApp } from './setup.mjs'

let app
let replSet
let db
let adminToken
let adminId

let slugCounter = 0
function nextSlug(prefix = 'cat') {
  return `${prefix}-${Date.now()}-${slugCounter++}`
}

before(async () => {
  const started = await startTestApp('mokuren_categories_test')
  app = started.app
  replSet = started.replSet
  db = started.db
  ;({ token: adminToken, adminId } = await createAdmin(db))
})

after(async () => {
  await stopTestApp(app, replSet)
})

async function createProductInCategory(categoryId, status = 'draft') {
  const productId = new Types.ObjectId()
  const categoryObjectId = new Types.ObjectId(categoryId)
  await db.collection('products').insertOne({
    _id: productId,
    name: 'Test Product',
    slug: `prod-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    categoryId: categoryObjectId,
    status,
    firstPublishedAt: status === 'published' ? new Date() : null,
    lastPublishedAt: status === 'published' ? new Date() : null,
    variants: [],
    imageIds: [],
    tasteNoteIds: [],
    description: '',
    lowStockThresholdGrams: 0,
  })
  return String(productId)
}

test('rejects unauthenticated category creation', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/admin/categories')
    .send({ name: 'Oolong', slug: nextSlug() })

  assert.equal(response.status, 401)
})

test('creates a category, normalizes the slug, and records audit atomically', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/admin/categories')
    .set(authHeaders(adminToken))
    .send({ name: 'Oolong', slug: '  OOLONG  ', sortOrder: 20 })

  assert.equal(response.status, 201)
  assert.equal(response.body.slug, 'oolong')
  assert.equal(response.body.name, 'Oolong')
  assert.equal(response.body.sortOrder, 20)
  assert.equal(response.body.productsCount, 0)
  assert.ok(typeof response.body.id === 'string' && response.body.id.length > 0)
  assert.ok(response.body.createdAt)
  assert.ok(response.body.updatedAt)
  assert.ok(!('referenceRevision' in response.body))
  assert.ok(!('__v' in response.body))

  const category = await db.collection('categories').findOne({ slug: 'oolong' })
  assert.ok(category)
  assert.equal(category.name, 'Oolong')
  assert.equal(category.slug, 'oolong')
  assert.equal(category.sortOrder, 20)
  assert.equal(category.referenceRevision, 0)
  assert.ok(category.createdAt)
  assert.ok(category.updatedAt)

  const audit = await db.collection('auditlogs').findOne({
    action: 'category.created',
    entityType: 'category',
    entityId: String(category._id),
  })
  assert.ok(audit)
  assert.equal(audit.actorId, adminId)
  assert.deepEqual(audit.changes, { name: 'Oolong', slug: 'oolong', sortOrder: 20 })
})

test('rejects a duplicate normalized slug with a conflict and no second category or audit', async () => {
  const slug = nextSlug('tea')
  const first = await request(app.getHttpServer())
    .post('/api/admin/categories')
    .set(authHeaders(adminToken))
    .send({ name: 'Tea', slug })
  assert.equal(first.status, 201)

  const beforeAudit = await db.collection('auditlogs').countDocuments()
  const beforeCategories = await db.collection('categories').countDocuments()

  const second = await request(app.getHttpServer())
    .post('/api/admin/categories')
    .set(authHeaders(adminToken))
    .send({ name: 'Tea', slug: slug.toUpperCase() })

  assert.equal(second.status, 409)
  assert.equal(second.body.code, 'CONFLICT')
  assert.equal(await db.collection('categories').countDocuments(), beforeCategories)
  assert.equal(await db.collection('auditlogs').countDocuments(), beforeAudit)

  const third = await request(app.getHttpServer())
    .post('/api/admin/categories')
    .set(authHeaders(adminToken))
    .send({ name: 'Tea', slug: `${slug}-2` })
  assert.equal(third.status, 201)
  assert.equal(third.body.name, 'Tea')
})

test('rejects invalid category input', async () => {
  const before = await db.collection('categories').countDocuments()

  const blank = await request(app.getHttpServer())
    .post('/api/admin/categories')
    .set(authHeaders(adminToken))
    .send({ name: '   ', slug: nextSlug('blank') })
  assert.equal(blank.status, 400)

  const malformed = await request(app.getHttpServer())
    .post('/api/admin/categories')
    .set(authHeaders(adminToken))
    .send({ name: 'Milk', slug: 'Milk Oolong' })
  assert.equal(malformed.status, 400)

  const oversized = await request(app.getHttpServer())
    .post('/api/admin/categories')
    .set(authHeaders(adminToken))
    .send({ name: 'Milk', slug: 'a'.repeat(301) })
  assert.equal(oversized.status, 400)

  assert.equal(await db.collection('categories').countDocuments(), before)
})

test('updates a category and records audit without changing slug on rename', async () => {
  const slug = nextSlug('oolong')
  const created = await request(app.getHttpServer())
    .post('/api/admin/categories')
    .set(authHeaders(adminToken))
    .send({ name: 'Oolong', slug })
  const id = created.body.id

  const updated = await request(app.getHttpServer())
    .patch(`/api/admin/categories/${id}`)
    .set(authHeaders(adminToken))
    .send({ name: 'Oolong Reserve' })

  assert.equal(updated.status, 200)
  assert.equal(updated.body.slug, slug)
  assert.equal(updated.body.name, 'Oolong Reserve')

  const category = await db.collection('categories').findOne({ _id: new Types.ObjectId(id) })
  assert.equal(category.name, 'Oolong Reserve')
  assert.equal(category.slug, slug)

  const audit = await db.collection('auditlogs').findOne({
    action: 'category.updated',
    entityType: 'category',
    entityId: id,
  })
  assert.ok(audit)
  assert.deepEqual(audit.changes, { name: 'Oolong Reserve' })
})

test('explicitly sets a new normalized slug on update and conflicts on duplicate', async () => {
  const first = await request(app.getHttpServer())
    .post('/api/admin/categories')
    .set(authHeaders(adminToken))
    .send({ name: 'A', slug: 'conflict-a' })
  assert.equal(first.status, 201)
  const second = await request(app.getHttpServer())
    .post('/api/admin/categories')
    .set(authHeaders(adminToken))
    .send({ name: 'B', slug: 'conflict-b' })
  assert.equal(second.status, 201)
  const id = second.body.id

  const conflict = await request(app.getHttpServer())
    .patch(`/api/admin/categories/${id}`)
    .set(authHeaders(adminToken))
    .send({ slug: 'CONFLICT-A' })
  assert.equal(conflict.status, 409)
  assert.equal(conflict.body.code, 'CONFLICT')

  const updated = await request(app.getHttpServer())
    .patch(`/api/admin/categories/${id}`)
    .set(authHeaders(adminToken))
    .send({ slug: nextSlug('cat-b-new') })
  assert.equal(updated.status, 200)
  assert.equal(updated.body.slug, updated.body.slug)
})

test('rejects an empty PATCH and explicit null fields', async () => {
  const slug = nextSlug('null')
  const created = await request(app.getHttpServer())
    .post('/api/admin/categories')
    .set(authHeaders(adminToken))
    .send({ name: 'Oolong', slug })
  const id = created.body.id

  const empty = await request(app.getHttpServer())
    .patch(`/api/admin/categories/${id}`)
    .set(authHeaders(adminToken))
    .send({})
  assert.equal(empty.status, 400)

  const nullSlug = await request(app.getHttpServer())
    .patch(`/api/admin/categories/${id}`)
    .set(authHeaders(adminToken))
    .send({ slug: null })
  assert.equal(nullSlug.status, 400)

  const before = await db.collection('categories').findOne({ slug })
  assert.equal(before.name, 'Oolong')
})

test('no-op PATCH returns the current view without changing timestamps or adding audit', async () => {
  const slug = nextSlug('noop')
  const created = await request(app.getHttpServer())
    .post('/api/admin/categories')
    .set(authHeaders(adminToken))
    .send({ name: 'Oolong', slug })
  const id = created.body.id

  const before = await db.collection('categories').findOne({ slug })
  const beforeUpdatedAt = before.updatedAt

  const response = await request(app.getHttpServer())
    .patch(`/api/admin/categories/${id}`)
    .set(authHeaders(adminToken))
    .send({ name: 'Oolong', slug, sortOrder: before.sortOrder })

  assert.equal(response.status, 200)
  assert.equal(response.body.name, 'Oolong')

  const after = await db.collection('categories').findOne({ slug })
  assert.equal(after.updatedAt.getTime(), beforeUpdatedAt.getTime())

  const noopAudit = await db.collection('auditlogs').countDocuments({
    action: 'category.updated',
    entityId: id,
  })
  assert.equal(noopAudit, 0)
})

test('rejects updates to an unknown category', async () => {
  const response = await request(app.getHttpServer())
    .patch('/api/admin/categories/64f000000000000000000000')
    .set(authHeaders(adminToken))
    .send({ name: 'Nope' })
  assert.equal(response.status, 404)
})

test('PATCH returns the actual all-status product count', async () => {
  const created = await request(app.getHttpServer())
    .post('/api/admin/categories')
    .set(authHeaders(adminToken))
    .send({ name: 'Oolong', slug: nextSlug() })
  const id = created.body.id

  // Create products of all statuses referencing the category.
  await createProductInCategory(id, 'draft')
  await createProductInCategory(id, 'published')
  await createProductInCategory(id, 'archived')

  // Rename returns the real count.
  const renamed = await request(app.getHttpServer())
    .patch(`/api/admin/categories/${id}`)
    .set(authHeaders(adminToken))
    .send({ name: 'Oolong Reserve' })
  assert.equal(renamed.status, 200)
  assert.equal(renamed.body.productsCount, 3)

  // Slug update returns the real count.
  const reslugged = await request(app.getHttpServer())
    .patch(`/api/admin/categories/${id}`)
    .set(authHeaders(adminToken))
    .send({ slug: nextSlug('oolong-reserve') })
  assert.equal(reslugged.status, 200)
  assert.equal(reslugged.body.productsCount, 3)

  // sortOrder update returns the real count.
  const reordered = await request(app.getHttpServer())
    .patch(`/api/admin/categories/${id}`)
    .set(authHeaders(adminToken))
    .send({ sortOrder: 5 })
  assert.equal(reordered.status, 200)
  assert.equal(reordered.body.productsCount, 3)

  // No-op PATCH returns the same real count, leaves timestamps and audit unchanged.
  const before = await db.collection('categories').findOne({ _id: new Types.ObjectId(id) })
  const beforeUpdatedAt = before.updatedAt
  const auditsBeforeNoop = await db.collection('auditlogs').countDocuments({
    action: 'category.updated',
    entityId: id,
  })
  const noop = await request(app.getHttpServer())
    .patch(`/api/admin/categories/${id}`)
    .set(authHeaders(adminToken))
    .send({ name: 'Oolong Reserve', slug: reslugged.body.slug, sortOrder: 5 })
  assert.equal(noop.status, 200)
  assert.equal(noop.body.productsCount, 3)

  const after = await db.collection('categories').findOne({ _id: new Types.ObjectId(id) })
  assert.equal(after.updatedAt.getTime(), beforeUpdatedAt.getTime())

  const auditsAfterNoop = await db.collection('auditlogs').countDocuments({
    action: 'category.updated',
    entityId: id,
  })
  assert.equal(auditsAfterNoop, auditsBeforeNoop) // no-op adds no audit
})

test('empty category returns zero product count on PATCH', async () => {
  const created = await request(app.getHttpServer())
    .post('/api/admin/categories')
    .set(authHeaders(adminToken))
    .send({ name: 'Empty', slug: nextSlug() })
  const id = created.body.id

  const updated = await request(app.getHttpServer())
    .patch(`/api/admin/categories/${id}`)
    .set(authHeaders(adminToken))
    .send({ name: 'Empty Renamed' })
  assert.equal(updated.status, 200)
  assert.equal(updated.body.productsCount, 0)
})

test('PATCH returns the same product count for lowercase and uppercase ObjectIds', async () => {
  const categoryId = new Types.ObjectId('abcdef0123456789abcdef01')
  const id = categoryId.toHexString()
  await db.collection('categories').insertOne({
    _id: categoryId,
    name: 'Case-insensitive ID',
    slug: nextSlug('id-case'),
    sortOrder: 0,
    referenceRevision: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  await createProductInCategory(id, 'draft')
  await createProductInCategory(id, 'published')
  await createProductInCategory(id, 'archived')

  for (const [requestId, name] of [
    [id, 'Lowercase update'],
    [id.toUpperCase(), 'Uppercase update'],
    [id.toUpperCase(), 'Uppercase update'],
  ]) {
    const response = await request(app.getHttpServer())
      .patch(`/api/admin/categories/${requestId}`)
      .set(authHeaders(adminToken))
      .send({ name })

    assert.equal(response.status, 200)
    assert.equal(response.body.id, id)
    assert.equal(response.body.productsCount, 3)
  }
})
