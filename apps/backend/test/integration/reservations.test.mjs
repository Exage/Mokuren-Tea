import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { after, before, test } from 'node:test'
import { Types } from 'mongoose'
import request from 'supertest'
import { encodeCredential, hashPassword } from '../../dist/auth/password.js'
import { createAdmin, seedReferences, startTestApp, stopTestApp } from './setup.mjs'

let app
let replSet
let db
let refs
let adminToken
let csrfToken

function fakeCloudinary() {
  const resources = new Map()
  return {
    isConfigured: () => true,
    buildPublicId: (assetId) => `mokuren-tea/test/${assetId}`,
    uploadImage: async (buffer, publicId) => {
      const result = {
        assetId: `fake-${publicId}`, publicId, version: 1,
        secureUrl: `https://res.cloudinary.com/fake/image/upload/${publicId}.jpg`,
        format: 'jpg', bytes: buffer.length, width: 800, height: 600,
      }
      resources.set(publicId, result)
      return result
    },
    destroyImage: async (publicId) => { resources.delete(publicId) },
    fetchResource: async (publicId) => resources.get(publicId) || null,
  }
}

before(async () => {
  const started = await startTestApp('mokuren_reservations_test', { cloudinary: fakeCloudinary() })
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

async function createProductWithStock(slug, weightGrams = 50, price = 21.9, stockGrams = 1000) {
  const productResp = await request(app.getHttpServer())
    .post('/api/admin/products')
    .set(adminHeaders())
    .send({
      name: `Product ${slug}`,
      slug,
      categoryId: refs.categoryId,
      imageIds: [refs.imageId],
      variants: [{ weightGrams, price, enabled: true }],
    })
  assert.equal(productResp.status, 201, `create product: ${JSON.stringify(productResp.body)}`)
  const product = productResp.body

  const publishResp = await request(app.getHttpServer())
    .post(`/api/admin/products/${product.id}/publish`)
    .set(adminHeaders())
  assert.equal(publishResp.status, 201, `publish product: ${JSON.stringify(publishResp.body)}`)

  await request(app.getHttpServer())
    .post('/api/admin/inventory/receipt')
    .set(adminHeaders())
    .send({ productId: product.id, grams: stockGrams, reason: 'Batch' })
    .expect(200)

  return product
}

function getVariantId(product) {
  return product.variants[0].variantId
}

async function getInventory(productId) {
  const inventory = await db.collection('inventories').findOne({
    productId: new Types.ObjectId(productId),
  })
  assert.ok(inventory, `inventory should exist for product ${productId}`)
  return inventory
}

test('public creation creates reservation in new status without reserve', async () => {
  const product = await createProductWithStock(`pub-${Date.now()}`)

  const response = await request(app.getHttpServer())
    .post('/api/public/reservations')
    .send({
      source: 'website',
      customerName: 'Anna Ivanova',
      customerPhone: '+375291234567',
      lines: [
        { productId: product.id, variantId: getVariantId(product), quantity: 2 },
      ],
    })

  assert.equal(response.status, 201, `create: ${JSON.stringify(response.body)}`)
  assert.equal(response.body.status, 'new')
  assert.equal(response.body.customerName, 'Anna Ivanova')
  assert.equal(response.body.customerPhone, '+375291234567')
  assert.equal(response.body.totalGrams, 100)
  assert.ok(response.body.number.startsWith('MT-'))
  assert.equal(response.body.lines.length, 1)
  assert.equal(response.body.lines[0].productName, product.name)

  const stock = await getInventory(product.id)
  assert.equal(stock.physicalGrams, 1000)
  assert.equal(stock.reservedGrams, 0)

  const reservation = await db.collection('reservations').findOne({ number: response.body.number })
  assert.ok(reservation)
  assert.equal(reservation.status, 'new')
})

test('creation rejects unpublished product', async () => {
  const draftResp = await request(app.getHttpServer())
    .post('/api/admin/products')
    .set(adminHeaders())
    .send({
      name: `Draft Product ${Date.now()}`,
      slug: `draft-${Date.now()}`,
      categoryId: refs.categoryId,
      imageIds: [refs.imageId],
      variants: [{ weightGrams: 50, price: 21.9, enabled: true }],
    })
  assert.equal(draftResp.status, 201)

  const response = await request(app.getHttpServer())
    .post('/api/public/reservations')
    .send({
      source: 'website',
      customerName: 'Test',
      customerPhone: '+375291234567',
      lines: [
        { productId: draftResp.body.id, variantId: draftResp.body.variants[0].variantId, quantity: 1 },
      ],
    })

  assert.equal(response.status, 409)
  assert.equal(response.body.code, 'PRODUCT_NOT_PUBLISHED')
})

test('creation rejects disabled variant', async () => {
  const product = await createProductWithStock(`disabled-${Date.now()}`)

  await request(app.getHttpServer())
    .patch(`/api/admin/products/${product.id}/variants/${getVariantId(product)}`)
    .set(adminHeaders())
    .send({ enabled: false })

  const response = await request(app.getHttpServer())
    .post('/api/public/reservations')
    .send({
      source: 'website',
      customerName: 'Test',
      customerPhone: '+375291234567',
      lines: [
        { productId: product.id, variantId: getVariantId(product), quantity: 1 },
      ],
    })

  assert.equal(response.status, 409)
})

test('insufficient stock at creation is rejected', async () => {
  const product = await createProductWithStock(`insufficient-${Date.now()}`, 50, 21.9, 10)

  const response = await request(app.getHttpServer())
    .post('/api/public/reservations')
    .send({
      source: 'website',
      customerName: 'Test',
      customerPhone: '+375291234567',
      lines: [
        { productId: product.id, variantId: getVariantId(product), quantity: 100 },
      ],
    })

  assert.equal(response.status, 409)
  assert.equal(response.body.code, 'INSUFFICIENT_STOCK')
})

test('admin confirm reserves stock atomically', async () => {
  const product = await createProductWithStock(`confirm-${Date.now()}`)

  const createResp = await request(app.getHttpServer())
    .post('/api/public/reservations')
    .send({
      source: 'website',
      customerName: 'Anna Ivanova',
      customerPhone: '+375291234567',
      lines: [
        { productId: product.id, variantId: getVariantId(product), quantity: 10 },
      ],
    })
  assert.equal(createResp.status, 201)
  const reservationId = createResp.body.id

  const confirmResp = await request(app.getHttpServer())
    .post(`/api/admin/reservations/${reservationId}/confirm`)
    .set(adminHeaders())
  assert.equal(confirmResp.status, 200, `confirm: ${JSON.stringify(confirmResp.body)}`)
  assert.equal(confirmResp.body.status, 'confirmed')

  const stock = await getInventory(product.id)
  assert.equal(stock.physicalGrams, 1000)
  assert.equal(stock.reservedGrams, 500)

  const movement = await db.collection('inventorymovements').findOne({
    productId: new Types.ObjectId(product.id),
    type: 'reserve',
  })
  assert.ok(movement)
  assert.equal(movement.delta.physicalGrams, 0)
  assert.equal(movement.delta.reservedGrams, 500)

  const event = await db.collection('reservationevents').findOne({
    reservationId: new Types.ObjectId(reservationId),
    action: 'status-changed',
  })
  assert.ok(event)
  assert.equal(event.newStatus, 'confirmed')
})

test('two confirmations on last grams do not double-reserve', async () => {
  const product = await createProductWithStock(`double-confirm-${Date.now()}`, 50, 21.9, 100)

  const res1Resp = await request(app.getHttpServer())
    .post('/api/public/reservations')
    .send({
      source: 'website',
      customerName: 'Customer 1',
      customerPhone: '+375291234567',
      lines: [{ productId: product.id, variantId: getVariantId(product), quantity: 1 }],
    })
  assert.equal(res1Resp.status, 201)

  const res2Resp = await request(app.getHttpServer())
    .post('/api/public/reservations')
    .send({
      source: 'website',
      customerName: 'Customer 2',
      customerPhone: '+375291234567',
      lines: [{ productId: product.id, variantId: getVariantId(product), quantity: 1 }],
    })
  assert.equal(res2Resp.status, 201)

  const conf1Resp = await request(app.getHttpServer())
    .post(`/api/admin/reservations/${res1Resp.body.id}/confirm`)
    .set(adminHeaders())
  assert.equal(conf1Resp.status, 200)

  const conf2Resp = await request(app.getHttpServer())
    .post(`/api/admin/reservations/${res2Resp.body.id}/confirm`)
    .set(adminHeaders())
  assert.equal(conf2Resp.status, 200)

  const stock = await getInventory(product.id)
  assert.equal(stock.physicalGrams, 100)
  assert.equal(stock.reservedGrams, 100)
})

test('insufficient stock at confirm rolls back all reservations', async () => {
  // Creation checks availability and rejects when stock is insufficient.
  const productB = await createProductWithStock(`rollback-b-${Date.now()}`, 50, 21.9, 10)

  const resResp = await request(app.getHttpServer())
    .post('/api/public/reservations')
    .send({
      source: 'website',
      customerName: 'Test',
      customerPhone: '+375291234567',
      lines: [
        { productId: productB.id, variantId: getVariantId(productB), quantity: 100 },
      ],
    })
  assert.equal(resResp.status, 409)
  assert.equal(resResp.body.code, 'INSUFFICIENT_STOCK')
})

test('ready does not change stock', async () => {
  const product = await createProductWithStock(`ready-${Date.now()}`)

  const createResp = await request(app.getHttpServer())
    .post('/api/public/reservations')
    .send({
      source: 'website',
      customerName: 'Test',
      customerPhone: '+375291234567',
      lines: [{ productId: product.id, variantId: getVariantId(product), quantity: 1 }],
    })
  assert.equal(createResp.status, 201)

  await request(app.getHttpServer())
    .post(`/api/admin/reservations/${createResp.body.id}/confirm`)
    .set(adminHeaders())

  const stockBefore = await getInventory(product.id)
  assert.equal(stockBefore.reservedGrams, 50)

  const readyResp = await request(app.getHttpServer())
    .post(`/api/admin/reservations/${createResp.body.id}/ready`)
    .set(adminHeaders())
  assert.equal(readyResp.status, 200)
  assert.equal(readyResp.body.status, 'ready')

  const stockAfter = await getInventory(product.id)
  assert.equal(stockAfter.physicalGrams, 1000)
  assert.equal(stockAfter.reservedGrams, 50)
})

test('complete decreases physical and reserved equally', async () => {
  const product = await createProductWithStock(`complete-${Date.now()}`)

  const createResp = await request(app.getHttpServer())
    .post('/api/public/reservations')
    .send({
      source: 'website',
      customerName: 'Test',
      customerPhone: '+375291234567',
      lines: [{ productId: product.id, variantId: getVariantId(product), quantity: 1 }],
    })
  assert.equal(createResp.status, 201)

  await request(app.getHttpServer())
    .post(`/api/admin/reservations/${createResp.body.id}/confirm`)
    .set(adminHeaders())
  await request(app.getHttpServer())
    .post(`/api/admin/reservations/${createResp.body.id}/ready`)
    .set(adminHeaders())

  const completeResp = await request(app.getHttpServer())
    .post(`/api/admin/reservations/${createResp.body.id}/complete`)
    .set(adminHeaders())
  assert.equal(completeResp.status, 200)
  assert.equal(completeResp.body.status, 'completed')

  const stock = await getInventory(product.id)
  assert.equal(stock.physicalGrams, 950)
  assert.equal(stock.reservedGrams, 0)
})

test('cancel new reservation does not change stock', async () => {
  const product = await createProductWithStock(`cancel-new-${Date.now()}`)

  const createResp = await request(app.getHttpServer())
    .post('/api/public/reservations')
    .send({
      source: 'website',
      customerName: 'Test',
      customerPhone: '+375291234567',
      lines: [{ productId: product.id, variantId: getVariantId(product), quantity: 1 }],
    })
  assert.equal(createResp.status, 201)

  const cancelResp = await request(app.getHttpServer())
    .post(`/api/admin/reservations/${createResp.body.id}/cancel`)
    .set(adminHeaders())
    .send({ teaReturned: false })
  assert.equal(cancelResp.status, 200)
  assert.equal(cancelResp.body.status, 'cancelled')

  const stock = await getInventory(product.id)
  assert.equal(stock.physicalGrams, 1000)
  assert.equal(stock.reservedGrams, 0)
})

test('cancel confirmed reservation releases reserved stock', async () => {
  const product = await createProductWithStock(`cancel-conf-${Date.now()}`)

  const createResp = await request(app.getHttpServer())
    .post('/api/public/reservations')
    .send({
      source: 'website',
      customerName: 'Test',
      customerPhone: '+375291234567',
      lines: [{ productId: product.id, variantId: getVariantId(product), quantity: 1 }],
    })
  assert.equal(createResp.status, 201)

  await request(app.getHttpServer())
    .post(`/api/admin/reservations/${createResp.body.id}/confirm`)
    .set(adminHeaders())

  const cancelResp = await request(app.getHttpServer())
    .post(`/api/admin/reservations/${createResp.body.id}/cancel`)
    .set(adminHeaders())
    .send({ teaReturned: false })
  assert.equal(cancelResp.status, 200)
  assert.equal(cancelResp.body.status, 'cancelled')

  const stock = await getInventory(product.id)
  assert.equal(stock.physicalGrams, 1000)
  assert.equal(stock.reservedGrams, 0)
})

test('cancel ready reservation requires teaReturned', async () => {
  const product = await createProductWithStock(`cancel-ready-${Date.now()}`)

  const createResp = await request(app.getHttpServer())
    .post('/api/public/reservations')
    .send({
      source: 'website',
      customerName: 'Test',
      customerPhone: '+375291234567',
      lines: [{ productId: product.id, variantId: getVariantId(product), quantity: 1 }],
    })
  assert.equal(createResp.status, 201)

  await request(app.getHttpServer())
    .post(`/api/admin/reservations/${createResp.body.id}/confirm`)
    .set(adminHeaders())
  await request(app.getHttpServer())
    .post(`/api/admin/reservations/${createResp.body.id}/ready`)
    .set(adminHeaders())

  const cancelResp = await request(app.getHttpServer())
    .post(`/api/admin/reservations/${createResp.body.id}/cancel`)
    .set(adminHeaders())
    .send({ teaReturned: false })
  assert.equal(cancelResp.status, 409)
  assert.equal(cancelResp.body.code, 'TEA_NOT_RETURNED')

  const stock = await getInventory(product.id)
  assert.equal(stock.physicalGrams, 1000)
  assert.equal(stock.reservedGrams, 50)

  const returned = await request(app.getHttpServer())
    .post(`/api/admin/reservations/${createResp.body.id}/cancel`)
    .set(adminHeaders())
    .send({ teaReturned: true })
  assert.equal(returned.status, 200, JSON.stringify(returned.body))
  const afterReturn = await getInventory(product.id)
  assert.equal(afterReturn.physicalGrams, 1000)
  assert.equal(afterReturn.reservedGrams, 0)
})

test('public idempotency key replays one reservation and rejects changed content', async () => {
  const product = await createProductWithStock(`idem-${Date.now()}`)
  const body = {
    source: 'website', customerName: 'Idempotent', customerPhone: '+375291234567',
    lines: [{ productId: product.id, variantId: getVariantId(product), quantity: 1 }],
  }
  const key = `create-${Date.now()}`
  const first = await request(app.getHttpServer()).post('/api/public/reservations')
    .set('Idempotency-Key', key).send(body)
  assert.equal(first.status, 201, JSON.stringify(first.body))
  const replay = await request(app.getHttpServer()).post('/api/public/reservations')
    .set('Idempotency-Key', key).send(body)
  assert.equal(replay.status, 201, JSON.stringify(replay.body))
  assert.equal(replay.body.id, first.body.id)

  const changed = await request(app.getHttpServer()).post('/api/public/reservations')
    .set('Idempotency-Key', key).send({ ...body, customerName: 'Changed' })
  assert.equal(changed.status, 409)
  assert.equal(changed.body.code, 'IDEMPOTENCY_CONFLICT')
  assert.equal(await db.collection('reservations').countDocuments({ number: first.body.number }), 1)
})

test('parallel public requests with one key cannot create two reservations', async () => {
  const product = await createProductWithStock(`idem-race-${Date.now()}`)
  const body = {
    source: 'website', customerName: 'Race', customerPhone: '+375291234567',
    lines: [{ productId: product.id, variantId: getVariantId(product), quantity: 1 }],
  }
  const key = `race-${Date.now()}`
  const responses = await Promise.all(Array.from({ length: 3 }, () =>
    request(app.getHttpServer()).post('/api/public/reservations')
      .set('Idempotency-Key', key).send(body)
  ))
  assert.ok(responses.some((response) => response.status === 201), JSON.stringify(responses.map((r) => r.body)))
  assert.ok(responses.every((response) => [201, 409].includes(response.status)))
  assert.equal(await db.collection('reservations').countDocuments({ customerName: 'Race' }), 1)
})

test('edit only allowed in new status', async () => {
  const product = await createProductWithStock(`edit-${Date.now()}`)

  const createResp = await request(app.getHttpServer())
    .post('/api/public/reservations')
    .send({
      source: 'website',
      customerName: 'Anna',
      customerPhone: '+375291234567',
      lines: [{ productId: product.id, variantId: getVariantId(product), quantity: 1 }],
    })
  assert.equal(createResp.status, 201)

  const editResp = await request(app.getHttpServer())
    .patch(`/api/admin/reservations/${createResp.body.id}`)
    .set(adminHeaders())
    .send({ customerName: 'Anna Updated' })
  assert.equal(editResp.status, 200)
  assert.equal(editResp.body.customerName, 'Anna Updated')

  await request(app.getHttpServer())
    .post(`/api/admin/reservations/${createResp.body.id}/confirm`)
    .set(adminHeaders())

  const editConfirmed = await request(app.getHttpServer())
    .patch(`/api/admin/reservations/${createResp.body.id}`)
    .set(adminHeaders())
    .send({ customerName: 'Should Fail' })
  assert.equal(editConfirmed.status, 409)
})

test('rejects invalid status transitions', async () => {
  const product = await createProductWithStock(`transitions-${Date.now()}`)

  const createResp = await request(app.getHttpServer())
    .post('/api/public/reservations')
    .send({
      source: 'website',
      customerName: 'Test',
      customerPhone: '+375291234567',
      lines: [{ productId: product.id, variantId: getVariantId(product), quantity: 1 }],
    })
  assert.equal(createResp.status, 201)

  const badResp = await request(app.getHttpServer())
    .post(`/api/admin/reservations/${createResp.body.id}/complete`)
    .set(adminHeaders())
  assert.equal(badResp.status, 409)
})

test('lists reservations with pagination', async () => {
  const product = await createProductWithStock(`list-${Date.now()}`)

  await request(app.getHttpServer())
    .post('/api/public/reservations')
    .send({
      source: 'website',
      customerName: 'Customer One',
      customerPhone: '+375291234567',
      lines: [{ productId: product.id, variantId: getVariantId(product), quantity: 1 }],
    })
  await request(app.getHttpServer())
    .post('/api/public/reservations')
    .send({
      source: 'website',
      customerName: 'Customer Two',
      customerPhone: '+375291234567',
      lines: [{ productId: product.id, variantId: getVariantId(product), quantity: 1 }],
    })

  const response = await request(app.getHttpServer())
    .get('/api/admin/reservations')
    .set(adminHeaders())

  assert.equal(response.status, 200)
  assert.ok(response.body.items.length >= 2)
  assert.ok(response.body.pagination.totalItems >= 2)
})

test('money is stored as Decimal128 and unchanged lines keep their price snapshot', async () => {
  const product = await createProductWithStock(`money-${Date.now()}`, 50, 0.29)
  const body = {
    source: 'website', customerName: 'Money', customerPhone: '+375291234567',
    lines: [{ productId: product.id, variantId: getVariantId(product), quantity: 3 }],
  }
  const created = await request(app.getHttpServer()).post('/api/public/reservations').send(body)
  assert.equal(created.status, 201, JSON.stringify(created.body))
  assert.equal(created.body.totalAmount, 0.87)
  const stored = await db.collection('reservations').findOne({ number: created.body.number })
  assert.equal(stored.totalAmount._bsontype, 'Decimal128')
  assert.equal(stored.lines[0].variantPrice._bsontype, 'Decimal128')
  assert.equal(stored.lines[0].lineTotal._bsontype, 'Decimal128')

  await request(app.getHttpServer())
    .patch(`/api/admin/products/${product.id}/variants/${getVariantId(product)}`)
    .set(adminHeaders()).send({ price: 0.49 }).expect(200)
  const edited = await request(app.getHttpServer())
    .patch(`/api/admin/reservations/${created.body.id}`).set(adminHeaders())
    .send({ lines: body.lines })
  assert.equal(edited.status, 200, JSON.stringify(edited.body))
  assert.equal(edited.body.totalAmount, 0.87)
  assert.equal(edited.body.lines[0].variantPrice, 0.29)

  const changedQuantity = await request(app.getHttpServer())
    .patch(`/api/admin/reservations/${created.body.id}`).set(adminHeaders())
    .send({ lines: [{ ...body.lines[0], quantity: 2 }] })
  assert.equal(changedQuantity.status, 200, JSON.stringify(changedQuantity.body))
  assert.equal(changedQuantity.body.totalAmount, 0.98)
  assert.equal(changedQuantity.body.lines[0].variantPrice, 0.49)
})

test('admin can create a new request without reserving stock', async () => {
  const product = await createProductWithStock(`admin-create-${Date.now()}`)
  const created = await request(app.getHttpServer()).post('/api/admin/reservations')
    .set(adminHeaders()).send({
      customerName: 'Walk-in', customerPhone: '+375291234567',
      lines: [{ productId: product.id, variantId: getVariantId(product), quantity: 1 }],
    })
  assert.equal(created.status, 201, JSON.stringify(created.body))
  assert.equal(created.body.source, 'admin')
  assert.equal(created.body.status, 'new')
  const stock = await getInventory(product.id)
  assert.equal(stock.reservedGrams, 0)
})

test('full HTTP path creates, stocks, publishes and fulfils a reservation', async () => {
  const email = `journey-${Date.now()}@example.com`
  const password = 'JourneyPassword123!'
  const credential = hashPassword(password)
  await db.collection('adminusers').insertOne({
    email, normalizedEmail: email, displayName: 'Journey Admin',
    passwordHash: encodeCredential(credential.hash, credential.salt),
    isActive: true, mustChangePassword: false,
  })
  const login = await request(app.getHttpServer()).post('/api/admin/auth/login')
    .set('cookie', `csrf_token=${csrfToken}`).set('x-csrf-token', csrfToken)
    .send({ email, password })
  assert.equal(login.status, 200, JSON.stringify(login.body))
  const loginCookie = login.headers['set-cookie'].find((value) => value.startsWith('admin_session='))
  assert.ok(loginCookie)
  const journeyHeaders = {
    cookie: `${loginCookie.split(';')[0]}; csrf_token=${csrfToken}`,
    'x-csrf-token': csrfToken,
  }
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, ...Array(32).fill(0)])
  const upload = await request(app.getHttpServer()).post('/api/admin/media-assets')
    .set(journeyHeaders).field('alt', 'Journey tea photo')
    .attach('file', jpeg, 'journey.jpg')
  assert.equal(upload.status, 201, JSON.stringify(upload.body))
  const createdProduct = await request(app.getHttpServer()).post('/api/admin/products')
    .set(journeyHeaders).send({
      name: 'Journey Tea', slug: `journey-${Date.now()}`,
      categoryId: refs.categoryId, imageIds: [upload.body.id],
      variants: [{ weightGrams: 50, price: 1.25, enabled: true }],
    })
  assert.equal(createdProduct.status, 201)
  const product = createdProduct.body
  await request(app.getHttpServer()).post('/api/admin/inventory/receipt')
    .set(journeyHeaders).send({ productId: product.id, grams: 100, reason: 'Delivery' }).expect(200)
  await request(app.getHttpServer()).post(`/api/admin/products/${product.id}/publish`)
    .set(journeyHeaders).expect(201)
  const catalog = await request(app.getHttpServer()).get(`/api/products/${product.slug}`)
  assert.equal(catalog.status, 200, JSON.stringify(catalog.body))

  const reservation = await request(app.getHttpServer()).post('/api/public/reservations')
    .set('Idempotency-Key', `journey-${Date.now()}`).send({
      source: 'website', customerName: 'Journey Customer', customerPhone: '+375291234567',
      lines: [{ productId: product.id, variantId: getVariantId(product), quantity: 1 }],
    })
  assert.equal(reservation.status, 201, JSON.stringify(reservation.body))
  const id = reservation.body.id
  await request(app.getHttpServer()).post(`/api/admin/reservations/${id}/confirm`)
    .set(journeyHeaders).expect(200)
  await request(app.getHttpServer()).post(`/api/admin/reservations/${id}/ready`)
    .set(journeyHeaders).expect(200)
  const completed = await request(app.getHttpServer()).post(`/api/admin/reservations/${id}/complete`)
    .set(journeyHeaders)
  assert.equal(completed.status, 200, JSON.stringify(completed.body))
  assert.equal(completed.body.status, 'completed')
  const stock = await getInventory(product.id)
  assert.equal(stock.physicalGrams, 50)
  assert.equal(stock.reservedGrams, 0)
  const movements = await db.collection('inventorymovements')
    .find({ reservationId: new Types.ObjectId(id) }).toArray()
  assert.deepEqual(movements.map((movement) => movement.type).sort(), ['complete', 'reserve'])
})

test('confirming several products rolls back every reserve when one has gone out of stock', async () => {
  const first = await createProductWithStock(`multi-first-${Date.now()}`, 50, 1.25, 50)
  const second = await createProductWithStock(`multi-second-${Date.now()}`, 50, 1.25, 50)
  const created = await request(app.getHttpServer()).post('/api/public/reservations').send({
    source: 'website', customerName: 'Two teas', customerPhone: '+375291234567',
    lines: [
      { productId: first.id, variantId: getVariantId(first), quantity: 1 },
      { productId: second.id, variantId: getVariantId(second), quantity: 1 },
    ],
  })
  assert.equal(created.status, 201)
  await request(app.getHttpServer()).post('/api/admin/inventory/write-off')
    .set(adminHeaders()).send({ productId: second.id, grams: 50, reason: 'Damaged' }).expect(200)
  const denied = await request(app.getHttpServer())
    .post(`/api/admin/reservations/${created.body.id}/confirm`).set(adminHeaders())
  assert.equal(denied.status, 409)
  assert.equal(denied.body.code, 'INSUFFICIENT_STOCK')
  assert.equal((await getInventory(first.id)).reservedGrams, 0)
  assert.equal((await getInventory(second.id)).reservedGrams, 0)
  assert.equal((await db.collection('reservations').findOne({ number: created.body.number })).status, 'new')
})

test('an existing request can be confirmed after its product is archived', async () => {
  const product = await createProductWithStock(`archive-snapshot-${Date.now()}`, 50, 2.5, 100)
  const body = {
    source: 'website', customerName: 'Snapshot Customer', customerPhone: '+375291234567',
    lines: [{ productId: product.id, variantId: getVariantId(product), quantity: 1 }],
  }
  const created = await request(app.getHttpServer()).post('/api/public/reservations').send(body)
  assert.equal(created.status, 201, JSON.stringify(created.body))
  await request(app.getHttpServer()).post(`/api/admin/products/${product.id}/archive`)
    .set(adminHeaders()).expect(201)
  const rejected = await request(app.getHttpServer()).post('/api/public/reservations').send(body)
  assert.equal(rejected.status, 409)
  assert.equal(rejected.body.code, 'PRODUCT_NOT_PUBLISHED')
  const confirmed = await request(app.getHttpServer())
    .post(`/api/admin/reservations/${created.body.id}/confirm`).set(adminHeaders())
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body))
  assert.equal(confirmed.body.lines[0].variantPrice, 2.5)
  assert.equal((await getInventory(product.id)).reservedGrams, 50)
})

test('parallel confirm and write-off never allocate the same grams twice', async () => {
  const product = await createProductWithStock(`confirm-writeoff-${Date.now()}`, 50, 2.5, 50)
  const created = await request(app.getHttpServer()).post('/api/public/reservations').send({
    source: 'website', customerName: 'Concurrent Customer', customerPhone: '+375291234567',
    lines: [{ productId: product.id, variantId: getVariantId(product), quantity: 1 }],
  })
  assert.equal(created.status, 201, JSON.stringify(created.body))
  const [confirm, writeOff] = await Promise.all([
    request(app.getHttpServer()).post(`/api/admin/reservations/${created.body.id}/confirm`)
      .set(adminHeaders()),
    request(app.getHttpServer()).post('/api/admin/inventory/write-off')
      .set(adminHeaders()).send({ productId: product.id, grams: 50, reason: 'Concurrent write-off' }),
  ])
  assert.deepEqual([confirm.status, writeOff.status].sort(), [200, 409],
    JSON.stringify([confirm.body, writeOff.body]))
  const stock = await getInventory(product.id)
  assert.ok(stock.physicalGrams >= stock.reservedGrams)
  assert.equal(stock.physicalGrams - stock.reservedGrams, 0)
  assert.equal(stock.reservedGrams, confirm.status === 200 ? 50 : 0)
  const stored = await db.collection('reservations').findOne({ _id: new Types.ObjectId(created.body.id) })
  assert.equal(stored.status, confirm.status === 200 ? 'confirmed' : 'new')
})
