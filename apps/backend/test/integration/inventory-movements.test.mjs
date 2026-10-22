import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { Types } from 'mongoose'
import request from 'supertest'
import { createAdmin, seedReferences, startTestApp, stopTestApp } from './setup.mjs'

let app
let replSet
let db
let refs
let adminToken
let csrfToken

before(async () => {
  const started = await startTestApp('mokuren_inventory_movements_test')
  app = started.app
  replSet = started.replSet
  db = started.db
  refs = await seedReferences(db)
  ;({ token: adminToken } = await createAdmin(db))

  const csrfRes = await request(app.getHttpServer())
    .get('/api/admin/auth/csrf-token')
  const cookies = csrfRes.headers['set-cookie']
  const cookieList = Array.isArray(cookies) ? cookies : [cookies]
  for (const entry of cookieList) {
    const match = entry.match(/^csrf_token=([^;]*)/)
    if (match) {
      csrfToken = match[1]
      break
    }
  }
  assert.ok(csrfToken, 'CSRF token should be issued')
})

after(async () => {
  await stopTestApp(app, replSet)
})

function adminHeaders() {
  return {
    cookie: `admin_session=${adminToken}; csrf_token=${csrfToken}`,
    'x-csrf-token': csrfToken,
  }
}

async function createProduct(slug, overrides = {}) {
  const response = await request(app.getHttpServer())
    .post('/api/admin/products')
    .set(adminHeaders())
    .send({
      name: `Test Product ${slug}`,
      slug,
      categoryId: refs.categoryId,
      imageIds: [refs.imageId],
      variants: [{ weightGrams: 50, price: 21.9, enabled: true }],
      ...overrides,
    })
  assert.equal(response.status, 201, `create product ${slug}: ${JSON.stringify(response.body)}`)
  return response.body
}

async function publishProduct(id) {
  const response = await request(app.getHttpServer())
    .post(`/api/admin/products/${id}/publish`)
    .set(adminHeaders())
  assert.equal(response.status, 201, `publish product: ${JSON.stringify(response.body)}`)
  return response.body
}

async function getInventory(productId) {
  return db.collection('inventories').findOne({
    productId: new Types.ObjectId(productId),
  })
}

test('receipt increases physical stock and creates movement + audit atomically', async () => {
  const product = await createProduct(`receipt-${Date.now()}`)
  await publishProduct(product.id)

  const before = await getInventory(product.id)
  assert.ok(before, 'inventory should exist')
  assert.equal(before.physicalGrams, 0)
  assert.equal(before.reservedGrams, 0)

  const response = await request(app.getHttpServer())
    .post('/api/admin/inventory/receipt')
    .set(adminHeaders())
    .send({ productId: product.id, grams: 1000, reason: 'New batch' })

  assert.equal(response.status, 200, `receipt: ${JSON.stringify(response.body)}`)
  assert.ok(response.body.movementId)
  assert.deepEqual(response.body.stock, {
    physicalGrams: 1000,
    reservedGrams: 0,
    availableGrams: 1000,
  })

  const after = await getInventory(product.id)
  assert.ok(after)
  assert.equal(after.physicalGrams, 1000)
  assert.equal(after.reservedGrams, 0)

  const movement = await db.collection('inventorymovements').findOne({
    productId: new Types.ObjectId(product.id),
    type: 'receipt',
  })
  assert.ok(movement)
  assert.equal(movement.before.physicalGrams, 0)
  assert.equal(movement.before.reservedGrams, 0)
  assert.equal(movement.delta.physicalGrams, 1000)
  assert.equal(movement.delta.reservedGrams, 0)
  assert.equal(movement.after.physicalGrams, 1000)
  assert.equal(movement.after.reservedGrams, 0)
  assert.equal(movement.reason, 'New batch')

  const audit = await db.collection('auditlogs').findOne({
    action: 'inventory.receipt',
    entityId: product.id,
  })
  assert.ok(audit)
})

test('write-off cannot exceed unreserved stock', async () => {
  const product = await createProduct(`writeoff-${Date.now()}`)
  await publishProduct(product.id)

  await request(app.getHttpServer())
    .post('/api/admin/inventory/receipt')
    .set(adminHeaders())
    .send({ productId: product.id, grams: 1000, reason: 'Batch' })

  const response = await request(app.getHttpServer())
    .post('/api/admin/inventory/write-off')
    .set(adminHeaders())
    .send({ productId: product.id, grams: 1500, reason: 'Too much' })

  assert.equal(response.status, 409, `write-off should fail: ${JSON.stringify(response.body)}`)

  const stock = await getInventory(product.id)
  assert.ok(stock)
  assert.equal(stock.physicalGrams, 1000)
  assert.equal(stock.reservedGrams, 0)

  const movements = await db.collection('inventorymovements').countDocuments({
    productId: new Types.ObjectId(product.id),
    type: 'write-off',
  })
  assert.equal(movements, 0)
})

test('adjustment sets physical stock to explicit target', async () => {
  const product = await createProduct(`adjust-${Date.now()}`)
  await publishProduct(product.id)

  await request(app.getHttpServer())
    .post('/api/admin/inventory/receipt')
    .set(adminHeaders())
    .send({ productId: product.id, grams: 1000, reason: 'Batch' })

  const response = await request(app.getHttpServer())
    .post('/api/admin/inventory/adjust')
    .set(adminHeaders())
    .send({ productId: product.id, targetPhysicalGrams: 750, reason: 'Recount' })

  assert.equal(response.status, 200, `adjust: ${JSON.stringify(response.body)}`)
  assert.deepEqual(response.body.stock, {
    physicalGrams: 750,
    reservedGrams: 0,
    availableGrams: 750,
  })

  const movement = await db.collection('inventorymovements').findOne({
    productId: new Types.ObjectId(product.id),
    type: 'adjustment',
  })
  assert.ok(movement)
  assert.equal(movement.before.physicalGrams, 1000)
  assert.equal(movement.before.reservedGrams, 0)
  assert.equal(movement.delta.physicalGrams, -250)
  assert.equal(movement.delta.reservedGrams, 0)
  assert.equal(movement.after.physicalGrams, 750)
  assert.equal(movement.after.reservedGrams, 0)
})

test('compensation reverses a movement and accounts for prior compensation', async () => {
  const product = await createProduct(`compensate-${Date.now()}`)
  await publishProduct(product.id)

  const receiptResp = await request(app.getHttpServer())
    .post('/api/admin/inventory/receipt')
    .set(adminHeaders())
    .send({ productId: product.id, grams: 1000, reason: 'Batch' })
  const receiptId = receiptResp.body.movementId

  const compResp = await request(app.getHttpServer())
    .post('/api/admin/inventory/compensate')
    .set(adminHeaders())
    .send({ movementId: receiptId, reason: 'Error' })

  assert.equal(compResp.status, 200, `compensate: ${JSON.stringify(compResp.body)}`)
  assert.deepEqual(compResp.body.stock, {
    physicalGrams: 0,
    reservedGrams: 0,
    availableGrams: 0,
  })

  const stock = await getInventory(product.id)
  assert.ok(stock)
  assert.equal(stock.physicalGrams, 0)
  assert.equal(stock.reservedGrams, 0)

  const repeatResp = await request(app.getHttpServer())
    .post('/api/admin/inventory/compensate')
    .set(adminHeaders())
    .send({ movementId: receiptId, reason: 'Again' })

  assert.equal(repeatResp.status, 409, `repeat compensate should fail: ${JSON.stringify(repeatResp.body)}`)
})

test('parallel write-offs do not break invariant', async () => {
  const product = await createProduct(`parallel-${Date.now()}`)
  await publishProduct(product.id)

  await request(app.getHttpServer())
    .post('/api/admin/inventory/receipt')
    .set(adminHeaders())
    .send({ productId: product.id, grams: 100, reason: 'Batch' })

  const promises = Array.from({ length: 6 }, () =>
    request(app.getHttpServer())
      .post('/api/admin/inventory/write-off')
      .set(adminHeaders())
      .send({ productId: product.id, grams: 20, reason: 'Parallel' })
  )
  const responses = await Promise.all(promises)

  const successes = responses.filter((r) => r.status === 200)
  const failures = responses.filter((r) => r.status === 409)
  assert.equal(successes.length, 5)
  assert.equal(failures.length, 1)

  const stock = await getInventory(product.id)
  assert.ok(stock)
  assert.equal(stock.physicalGrams, 0)
  assert.equal(stock.reservedGrams, 0)
})

test('lists movements with filters and pagination', async () => {
  const product = await createProduct(`list-${Date.now()}`)
  await publishProduct(product.id)

  await request(app.getHttpServer())
    .post('/api/admin/inventory/receipt')
    .set(adminHeaders())
    .send({ productId: product.id, grams: 500, reason: 'First' })

  await request(app.getHttpServer())
    .post('/api/admin/inventory/receipt')
    .set(adminHeaders())
    .send({ productId: product.id, grams: 300, reason: 'Second' })

  const response = await request(app.getHttpServer())
    .get(`/api/admin/inventory/movements?productId=${product.id}`)
    .set(adminHeaders())

  assert.equal(response.status, 200)
  assert.equal(response.body.items.length, 2)
  assert.equal(response.body.pagination.totalItems, 2)
  assert.equal(response.body.items[0].type, 'receipt')
  assert.equal(response.body.items[1].type, 'receipt')
})

test('rejects invalid product id', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/admin/inventory/receipt')
    .set(adminHeaders())
    .send({ productId: 'not-an-id', grams: 100, reason: 'Bad' })

  assert.equal(response.status, 400)
})

test('receipt idempotency replays one movement and rejects a changed body', async () => {
  const product = await createProduct(`idem-receipt-${Date.now()}`)
  const key = `receipt-${Date.now()}`
  const body = { productId: product.id, grams: 120, reason: 'Delivery' }
  const first = await request(app.getHttpServer()).post('/api/admin/inventory/receipt')
    .set(adminHeaders()).set('Idempotency-Key', key).send(body)
  assert.equal(first.status, 200, JSON.stringify(first.body))
  const replay = await request(app.getHttpServer()).post('/api/admin/inventory/receipt')
    .set(adminHeaders()).set('Idempotency-Key', key).send(body)
  assert.equal(replay.status, 200, JSON.stringify(replay.body))
  assert.equal(replay.body.movementId, first.body.movementId)
  const changed = await request(app.getHttpServer()).post('/api/admin/inventory/receipt')
    .set(adminHeaders()).set('Idempotency-Key', key).send({ ...body, grams: 121 })
  assert.equal(changed.status, 409)
  const stock = await getInventory(product.id)
  assert.equal(stock.physicalGrams, 120)
})

test('failed keyed operation can be corrected and retried', async () => {
  const product = await createProduct(`idem-fail-${Date.now()}`)
  const key = `writeoff-${Date.now()}`
  const body = { productId: product.id, grams: 50, reason: 'Damaged' }
  const failed = await request(app.getHttpServer()).post('/api/admin/inventory/write-off')
    .set(adminHeaders()).set('Idempotency-Key', key).send(body)
  assert.equal(failed.status, 409)
  await request(app.getHttpServer()).post('/api/admin/inventory/receipt')
    .set(adminHeaders()).send({ productId: product.id, grams: 50, reason: 'Delivery' }).expect(200)
  const retried = await request(app.getHttpServer()).post('/api/admin/inventory/write-off')
    .set(adminHeaders()).set('Idempotency-Key', key).send(body)
  assert.equal(retried.status, 200, JSON.stringify(retried.body))
})

test('compensating a write-off restores physical stock once', async () => {
  const product = await createProduct(`writeoff-correction-${Date.now()}`)
  await request(app.getHttpServer()).post('/api/admin/inventory/receipt')
    .set(adminHeaders()).send({ productId: product.id, grams: 100, reason: 'Delivery' }).expect(200)
  const writeOff = await request(app.getHttpServer()).post('/api/admin/inventory/write-off')
    .set(adminHeaders()).send({ productId: product.id, grams: 30, reason: 'Mistake' })
  assert.equal(writeOff.status, 200)
  const correction = await request(app.getHttpServer()).post('/api/admin/inventory/compensate')
    .set(adminHeaders()).send({ movementId: writeOff.body.movementId, reason: 'Correction' })
  assert.equal(correction.status, 200, JSON.stringify(correction.body))
  assert.equal(correction.body.stock.physicalGrams, 100)
  const repeated = await request(app.getHttpServer()).post('/api/admin/inventory/compensate')
    .set(adminHeaders()).send({ movementId: writeOff.body.movementId, reason: 'Again' })
  assert.equal(repeated.status, 409)
})
