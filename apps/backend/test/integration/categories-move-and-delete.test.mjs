import assert from 'node:assert/strict'
import { after, afterEach, before, test } from 'node:test'
import { Types } from 'mongoose'
import request from 'supertest'
import { authHeaders, createAdmin, seedReferences, startTestApp, stopTestApp } from './setup.mjs'

let app
let replSet
let db
let adminToken
let adminId
let refs

before(async () => {
  const started = await startTestApp('mokuren_categories_move_test')
  app = started.app
  replSet = started.replSet
  db = started.db
  ;({ token: adminToken, adminId } = await createAdmin(db))
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

async function createProductInCategory(categoryId) {
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
    })
  assert.equal(response.status, 201)
  return response.body
}

async function moveAndDelete(sourceId, body = {}) {
  const response = await request(app.getHttpServer())
    .post(`/api/admin/categories/${sourceId}/move-and-delete`)
    .set(authHeaders(adminToken))
    .send(body)
  return response
}

test('rejects unauthenticated move-and-delete', async () => {
  const cat = await createCategory({ name: 'C', slug: 'c' })
  const response = await request(app.getHttpServer())
    .post(`/api/admin/categories/${cat.id}/move-and-delete`)
    .send({})
  assert.equal(response.status, 401)
})

test('empty deletion works without a target', async () => {
  const cat = await createCategory({ name: 'Empty', slug: 'empty' })

  const response = await moveAndDelete(cat.id, {})
  assert.equal(response.status, 200)
  assert.equal(response.body.deletedCategoryId, cat.id)
  assert.equal(response.body.targetCategoryId, null)
  assert.equal(response.body.movedProductsCount, 0)

  const source = await db.collection('categories').findOne({ _id: new Types.ObjectId(cat.id) })
  assert.equal(source, null)

  const audit = await db.collection('auditlogs').findOne({
    action: 'category.deleted',
    entityType: 'category',
    entityId: cat.id,
  })
  assert.ok(audit)
  assert.equal(audit.actorId, adminId)
})

test('used deletion without a target returns CATEGORY_TARGET_REQUIRED unchanged', async () => {
  const cat = await createCategory({ name: 'Used', slug: 'used' })
  await createProductInCategory(cat.id)

  const before = await db.collection('categories').countDocuments()
  const response = await moveAndDelete(cat.id, {})
  assert.equal(response.status, 409)
  assert.equal(response.body.code, 'CATEGORY_TARGET_REQUIRED')
  assert.equal(await db.collection('categories').countDocuments(), before)
})

test('rejects invalid, null, and identical targets', async () => {
  const source = await createCategory({ name: 'S', slug: 's' })
  const target = await createCategory({ name: 'T', slug: 't' })

  const invalidTarget = await moveAndDelete(source.id, { targetCategoryId: 'not-an-id' })
  assert.equal(invalidTarget.status, 400)

  const nullTarget = await moveAndDelete(source.id, { targetCategoryId: null })
  assert.equal(nullTarget.status, 400)

  const sameTarget = await moveAndDelete(source.id, { targetCategoryId: source.id })
  assert.equal(sameTarget.status, 400)

  const missingTarget = await moveAndDelete(source.id, { targetCategoryId: new Types.ObjectId().toHexString() })
  assert.equal(missingTarget.status, 404)

  const missingSource = await moveAndDelete(new Types.ObjectId().toHexString(), {
    targetCategoryId: target.id,
  })
  assert.equal(missingSource.status, 404)
})

test('moves every product status to the target and removes the source', async () => {
  const source = await createCategory({ name: 'Source', slug: 'source' })
  const target = await createCategory({ name: 'Target', slug: 'target' })

  await createProductInCategory(source.id)
  await createProductInCategory(source.id)
  await createProductInCategory(source.id)

  // Capture product field values before the transfer.
  const beforeProducts = await db
    .collection('products')
    .find({ categoryId: new Types.ObjectId(source.id) })
    .toArray()

  const response = await moveAndDelete(source.id, { targetCategoryId: target.id })
  assert.equal(response.status, 200)
  assert.equal(response.body.deletedCategoryId, source.id)
  assert.equal(response.body.targetCategoryId, target.id)
  assert.equal(response.body.movedProductsCount, 3)

  // Source removed, no products reference it.
  assert.equal(await db.collection('categories').countDocuments({ _id: new Types.ObjectId(source.id) }), 0)
  assert.equal(
    await db.collection('products').countDocuments({ categoryId: new Types.ObjectId(source.id) }),
    0
  )

  // Every product now references the target.
  const afterProducts = await db
    .collection('products')
    .find({ categoryId: new Types.ObjectId(target.id) })
    .toArray()
  assert.equal(afterProducts.length, 3)

  // Product fields other than categoryId are unchanged.
  const beforeById = new Map(beforeProducts.map((p) => [String(p._id), p]))
  for (const after of afterProducts) {
    const before = beforeById.get(String(after._id))
    assert.ok(before)
    assert.equal(after.name, before.name)
    assert.equal(after.status, before.status)
    assert.equal(after.slug, before.slug)
    assert.equal(after.price && after.price ? JSON.stringify(after.price) : null, before.price ? JSON.stringify(before.price) : null)
  }
})

test('existing target products are preserved', async () => {
  const source = await createCategory({ name: 'Source', slug: 'source' })
  const target = await createCategory({ name: 'Target', slug: 'target' })

  await createProductInCategory(source.id)
  const targetProduct = await createProductInCategory(target.id)

  const response = await moveAndDelete(source.id, { targetCategoryId: target.id })
  assert.equal(response.status, 200)
  assert.equal(response.body.movedProductsCount, 1)

  const afterTarget = await db.collection('products').findOne({ _id: new Types.ObjectId(targetProduct.id) })
  assert.equal(afterTarget.categoryId.toHexString(), target.id)
})

test('over-limit transfer changes nothing and returns the documented error', async () => {
  const source = await createCategory({ name: 'Source', slug: 'source' })
  const target = await createCategory({ name: 'Target', slug: 'target' })

  const sourceObjectId = new Types.ObjectId(source.id)

  await db.collection('products').insertMany(
    Array.from({ length: 1001 }, () => ({
      _id: new Types.ObjectId(),
      name: 'Bulk Product',
      slug: `bulk-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      categoryId: sourceObjectId,
      status: 'draft',
    }))
  )

  assert.equal(
    await db.collection('products').countDocuments({ categoryId: sourceObjectId }),
    1001
  )

  const response = await moveAndDelete(source.id, { targetCategoryId: target.id })
  assert.equal(response.status, 409)
  assert.equal(response.body.code, 'CATEGORY_TRANSFER_TOO_LARGE')

  // Nothing changed: source still exists and all products still reference it.
  assert.ok(await db.collection('categories').findOne({ _id: sourceObjectId }))
  assert.equal(
    await db.collection('products').countDocuments({ categoryId: sourceObjectId }),
    1001
  )
})

test('repeat deletion returns 404 and makes no new changes', async () => {
  const cat = await createCategory({ name: 'Gone', slug: 'gone' })

  const first = await moveAndDelete(cat.id, {})
  assert.equal(first.status, 200)

  const auditBefore = await db.collection('auditlogs').countDocuments()
  const categoriesBefore = await db.collection('categories').countDocuments()

  const second = await moveAndDelete(cat.id, {})
  assert.equal(second.status, 404)
  assert.equal(await db.collection('auditlogs').countDocuments(), auditBefore)
  assert.equal(await db.collection('categories').countDocuments(), categoriesBefore)
})
