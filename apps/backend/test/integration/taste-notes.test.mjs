import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { Types } from 'mongoose'
import request from 'supertest'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { TasteNotesService } from '../../dist/taste-notes/taste-notes.service.js'
import { AuditService } from '../../dist/audit/audit.service.js'
import { authHeaders, createAdmin, startTestApp, stopTestApp } from './setup.mjs'

let app
let replSet
let db
let adminToken
let adminId

let slugCounter = 0
function nextSlug(prefix = 'taste') {
  return `${prefix}-${Date.now()}-${slugCounter++}`
}

before(async () => {
  const started = await startTestApp('mokuren_taste_notes_test')
  app = started.app
  replSet = started.replSet
  db = started.db
  ;({ token: adminToken, adminId } = await createAdmin(db))
})

after(async () => {
  await stopTestApp(app, replSet)
})

async function createProduct(tasteNoteIds, status = 'draft') {
  const productId = new Types.ObjectId()
  const noteObjectIds = tasteNoteIds.map((id) => new Types.ObjectId(id))
  await db.collection('products').insertOne({
    _id: productId,
    name: 'Test Product',
    slug: `prod-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    tasteNoteIds: noteObjectIds,
    imageIds: [],
    variants: [],
    status,
    firstPublishedAt: status === 'published' ? new Date() : null,
    lastPublishedAt: status === 'published' ? new Date() : null,
    description: '',
    lowStockThresholdGrams: 0,
  })
  return String(productId)
}

test('rejects unauthenticated taste-note creation', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/admin/taste-notes')
    .send({ name: 'Цветочный', slug: 'floral' })

  assert.equal(response.status, 401)
})

test('creates a taste note, normalizes the slug, and records audit atomically', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/admin/taste-notes')
    .set(authHeaders(adminToken))
    .send({ name: '  Цветочный  ', slug: '  FLORAL  ', sortOrder: 10 })

  assert.equal(response.status, 201)
  assert.equal(response.body.slug, 'floral')
  assert.equal(response.body.name, 'Цветочный')
  assert.equal(response.body.sortOrder, 10)
  assert.equal(response.body.productsCount, 0)
  assert.ok(typeof response.body.id === 'string' && response.body.id.length > 0)
  assert.ok(response.body.createdAt)
  assert.ok(response.body.updatedAt)
  assert.ok(!('referenceRevision' in response.body))
  assert.ok(!('__v' in response.body))

  const note = await db.collection('tastenotes').findOne({ slug: 'floral' })
  assert.ok(note)
  assert.equal(note.name, 'Цветочный')
  assert.equal(note.slug, 'floral')
  assert.equal(note.sortOrder, 10)
  assert.equal(note.referenceRevision, 0)
  assert.ok(note.createdAt)
  assert.ok(note.updatedAt)

  const audit = await db.collection('auditlogs').findOne({
    action: 'taste-note.created',
    entityType: 'taste-note',
    entityId: String(note._id),
  })
  assert.ok(audit)
  assert.equal(audit.actorId, adminId)
  assert.deepEqual(audit.changes, { name: 'Цветочный', slug: 'floral', sortOrder: 10 })
})

test('rejects a duplicate normalized slug with a conflict and no second note or audit', async () => {
  const slug = nextSlug('tea')
  const first = await request(app.getHttpServer())
    .post('/api/admin/taste-notes')
    .set(authHeaders(adminToken))
    .send({ name: 'Чайный', slug })
  assert.equal(first.status, 201)

  const beforeAudit = await db.collection('auditlogs').countDocuments()
  const beforeNotes = await db.collection('tastenotes').countDocuments()

  const second = await request(app.getHttpServer())
    .post('/api/admin/taste-notes')
    .set(authHeaders(adminToken))
    .send({ name: 'Чайный', slug: slug.toUpperCase() })

  assert.equal(second.status, 409)
  assert.equal(second.body.code, 'CONFLICT')
  assert.equal(await db.collection('tastenotes').countDocuments(), beforeNotes)
  assert.equal(await db.collection('auditlogs').countDocuments(), beforeAudit)

  const third = await request(app.getHttpServer())
    .post('/api/admin/taste-notes')
    .set(authHeaders(adminToken))
    .send({ name: 'Чайный', slug: `${slug}-2` })
  assert.equal(third.status, 201)
  assert.equal(third.body.name, 'Чайный')
})

test('rejects invalid taste-note input', async () => {
  const before = await db.collection('tastenotes').countDocuments()

  const blank = await request(app.getHttpServer())
    .post('/api/admin/taste-notes')
    .set(authHeaders(adminToken))
    .send({ name: '   ', slug: nextSlug('blank') })
  assert.equal(blank.status, 400)

  const malformed = await request(app.getHttpServer())
    .post('/api/admin/taste-notes')
    .set(authHeaders(adminToken))
    .send({ name: 'Floral', slug: 'Floral Note' })
  assert.equal(malformed.status, 400)

  const negative = await request(app.getHttpServer())
    .post('/api/admin/taste-notes')
    .set(authHeaders(adminToken))
    .send({ name: 'Floral', slug: 'floral-neg', sortOrder: -5 })
  assert.equal(negative.status, 400)

  const oversized = await request(app.getHttpServer())
    .post('/api/admin/taste-notes')
    .set(authHeaders(adminToken))
    .send({ name: 'x'.repeat(301), slug: 'floral-big' })
  assert.equal(oversized.status, 400)

  assert.equal(await db.collection('tastenotes').countDocuments(), before)
})

test('updates a taste note and keeps the slug on rename, recording audit', async () => {
  const slug = nextSlug('floral')
  const created = await request(app.getHttpServer())
    .post('/api/admin/taste-notes')
    .set(authHeaders(adminToken))
    .send({ name: 'Цветочный', slug })
  const id = created.body.id

  const updated = await request(app.getHttpServer())
    .patch(`/api/admin/taste-notes/${id}`)
    .set(authHeaders(adminToken))
    .send({ name: 'Цветочный аромат' })

  assert.equal(updated.status, 200)
  assert.equal(updated.body.slug, slug)
  assert.equal(updated.body.name, 'Цветочный аромат')

  const note = await db.collection('tastenotes').findOne({ _id: new Types.ObjectId(id) })
  assert.equal(note.name, 'Цветочный аромат')
  assert.equal(note.slug, slug)

  const audit = await db.collection('auditlogs').findOne({
    action: 'taste-note.updated',
    entityType: 'taste-note',
    entityId: id,
  })
  assert.ok(audit)
  assert.deepEqual(audit.changes, { name: 'Цветочный аромат' })
})

test('sets a new normalized slug on update and conflicts on duplicate', async () => {
  const first = await request(app.getHttpServer())
    .post('/api/admin/taste-notes')
    .set(authHeaders(adminToken))
    .send({ name: 'A', slug: 'conflict-a' })
  assert.equal(first.status, 201)
  const second = await request(app.getHttpServer())
    .post('/api/admin/taste-notes')
    .set(authHeaders(adminToken))
    .send({ name: 'B', slug: 'conflict-b' })
  assert.equal(second.status, 201)
  const id = second.body.id

  const conflict = await request(app.getHttpServer())
    .patch(`/api/admin/taste-notes/${id}`)
    .set(authHeaders(adminToken))
    .send({ slug: 'CONFLICT-A' })
  assert.equal(conflict.status, 409)
  assert.equal(conflict.body.code, 'CONFLICT')

  const next = nextSlug('taste-new')
  const updated = await request(app.getHttpServer())
    .patch(`/api/admin/taste-notes/${id}`)
    .set(authHeaders(adminToken))
    .send({ slug: next.toUpperCase() })
  assert.equal(updated.status, 200)
  assert.equal(updated.body.slug, next)
})

test('rejects an empty PATCH and explicit null fields', async () => {
  const slug = nextSlug('null')
  const created = await request(app.getHttpServer())
    .post('/api/admin/taste-notes')
    .set(authHeaders(adminToken))
    .send({ name: 'Цветочный', slug })
  const id = created.body.id

  const empty = await request(app.getHttpServer())
    .patch(`/api/admin/taste-notes/${id}`)
    .set(authHeaders(adminToken))
    .send({})
  assert.equal(empty.status, 400)

  const nullSlug = await request(app.getHttpServer())
    .patch(`/api/admin/taste-notes/${id}`)
    .set(authHeaders(adminToken))
    .send({ slug: null })
  assert.equal(nullSlug.status, 400)

  const before = await db.collection('tastenotes').findOne({ slug })
  assert.equal(before.name, 'Цветочный')
})

test('no-op PATCH returns the current view without changing timestamps or adding audit', async () => {
  const slug = nextSlug('noop')
  const created = await request(app.getHttpServer())
    .post('/api/admin/taste-notes')
    .set(authHeaders(adminToken))
    .send({ name: 'Цветочный', slug })
  const id = created.body.id

  const before = await db.collection('tastenotes').findOne({ slug })
  const beforeUpdatedAt = before.updatedAt

  const response = await request(app.getHttpServer())
    .patch(`/api/admin/taste-notes/${id}`)
    .set(authHeaders(adminToken))
    .send({ name: 'Цветочный', slug, sortOrder: before.sortOrder })

  assert.equal(response.status, 200)
  assert.equal(response.body.name, 'Цветочный')

  const after = await db.collection('tastenotes').findOne({ slug })
  assert.equal(after.updatedAt.getTime(), beforeUpdatedAt.getTime())

  const noopAudit = await db.collection('auditlogs').countDocuments({
    action: 'taste-note.updated',
    entityId: id,
  })
  assert.equal(noopAudit, 0)
})

test('rejects updates to an unknown taste note', async () => {
  const response = await request(app.getHttpServer())
    .patch('/api/admin/taste-notes/64f000000000000000000000')
    .set(authHeaders(adminToken))
    .send({ name: 'Nope' })
  assert.equal(response.status, 404)
})

test('PATCH returns the actual all-status product count', async () => {
  const created = await request(app.getHttpServer())
    .post('/api/admin/taste-notes')
    .set(authHeaders(adminToken))
    .send({ name: 'Цветочный', slug: nextSlug() })
  const id = created.body.id

  await createProduct([id], 'draft')
  await createProduct([id], 'published')
  await createProduct([id], 'archived')

  const renamed = await request(app.getHttpServer())
    .patch(`/api/admin/taste-notes/${id}`)
    .set(authHeaders(adminToken))
    .send({ name: 'Цветочный аромат' })
  assert.equal(renamed.status, 200)
  assert.equal(renamed.body.productsCount, 3)
})

test('empty taste note returns zero product count on PATCH', async () => {
  const created = await request(app.getHttpServer())
    .post('/api/admin/taste-notes')
    .set(authHeaders(adminToken))
    .send({ name: 'Empty', slug: nextSlug() })
  const id = created.body.id

  const updated = await request(app.getHttpServer())
    .patch(`/api/admin/taste-notes/${id}`)
    .set(authHeaders(adminToken))
    .send({ name: 'Empty Renamed' })
  assert.equal(updated.status, 200)
  assert.equal(updated.body.productsCount, 0)
})

test('usages endpoint returns the count of referencing products', async () => {
  const created = await request(app.getHttpServer())
    .post('/api/admin/taste-notes')
    .set(authHeaders(adminToken))
    .send({ name: 'Цветочный', slug: nextSlug() })
  const id = created.body.id

  await createProduct([id], 'draft')
  await createProduct([id], 'published')

  const usages = await request(app.getHttpServer())
    .get(`/api/admin/taste-notes/${id}/usages`)
    .set(authHeaders(adminToken))
    .expect(200)

  assert.equal(usages.body.productsCount, 2)

  const unknown = await request(app.getHttpServer())
    .get('/api/admin/taste-notes/64f000000000000000000000/usages')
    .set(authHeaders(adminToken))
  assert.equal(unknown.status, 404)
})

test('public list returns only taste notes referenced by published products, sorted', async () => {
  // Earlier tests share the same database, so reset the collections this test
  // relies on for a deterministic result.
  await db.collection('products').deleteMany({})
  await db.collection('tastenotes').deleteMany({})

  const floral = await request(app.getHttpServer())
    .post('/api/admin/taste-notes')
    .set(authHeaders(adminToken))
    .send({ name: 'Цветочный', slug: 'floral', sortOrder: 20 })
  const creamy = await request(app.getHttpServer())
    .post('/api/admin/taste-notes')
    .set(authHeaders(adminToken))
    .send({ name: 'Кремовый', slug: 'creamy', sortOrder: 10 })
  const unused = await request(app.getHttpServer())
    .post('/api/admin/taste-notes')
    .set(authHeaders(adminToken))
    .send({ name: 'Неиспользуемый', slug: 'unused', sortOrder: 5 })

  await createProduct([floral.body.id, creamy.body.id], 'published')
  await createProduct([unused.body.id], 'draft')

  const response = await request(app.getHttpServer()).get('/api/taste-notes').expect(200)

  assert.equal(response.body.items.length, 2)
  assert.deepEqual(
    response.body.items.map((item) => item.slug),
    ['creamy', 'floral']
  )
  assert.deepEqual(
    response.body.items.map((item) => ({ id: item.id, name: item.name, sortOrder: item.sortOrder })),
    [
      { id: creamy.body.id, name: 'Кремовый', sortOrder: 10 },
      { id: floral.body.id, name: 'Цветочный', sortOrder: 20 },
    ]
  )
  assert.ok(!response.body.items.some((item) => item.id === unused.body.id))
  assert.ok(!('productsCount' in response.body.items[0]))
  assert.ok(!('createdAt' in response.body.items[0]))
})

test('deletes a taste note, removes it from all products, and records audit', async () => {
  const created = await request(app.getHttpServer())
    .post('/api/admin/taste-notes')
    .set(authHeaders(adminToken))
    .send({ name: 'Цветочный', slug: nextSlug() })
  const id = created.body.id

  const draftProduct = await createProduct([id], 'draft')
  const publishedProduct = await createProduct([id], 'published')
  const otherProduct = await createProduct([], 'published')

  const usagesBefore = await request(app.getHttpServer())
    .get(`/api/admin/taste-notes/${id}/usages`)
    .set(authHeaders(adminToken))
    .expect(200)
  assert.equal(usagesBefore.body.productsCount, 2)

  const deleted = await request(app.getHttpServer())
    .delete(`/api/admin/taste-notes/${id}`)
    .set(authHeaders(adminToken))
    .expect(200)

  assert.equal(deleted.body.deletedTasteNoteId, id)
  assert.equal(deleted.body.affectedProductsCount, 2)

  const note = await db.collection('tastenotes').findOne({ _id: new Types.ObjectId(id) })
  assert.equal(note, null)

  const draftAfter = await db.collection('products').findOne({ _id: new Types.ObjectId(draftProduct) })
  assert.deepEqual(draftAfter.tasteNoteIds, [])
  const publishedAfter = await db.collection('products').findOne({ _id: new Types.ObjectId(publishedProduct) })
  assert.deepEqual(publishedAfter.tasteNoteIds, [])
  const otherAfter = await db.collection('products').findOne({ _id: new Types.ObjectId(otherProduct) })
  assert.deepEqual(otherAfter.tasteNoteIds, [])

  const audit = await db.collection('auditlogs').findOne({
    action: 'taste-note.deleted',
    entityType: 'taste-note',
    entityId: id,
  })
  assert.ok(audit)
  assert.equal(audit.actorId, adminId)
  assert.equal(audit.metadata.tasteNoteName, 'Цветочный')
  assert.equal(audit.metadata.tasteNoteSlug, created.body.slug)
  assert.equal(audit.metadata.affectedProductsCount, 2)
})

test('repeated deletion of an absent taste note returns 404 and no audit', async () => {
  const id = new Types.ObjectId().toHexString()

  const beforeAudit = await db.collection('auditlogs').countDocuments()

  const response = await request(app.getHttpServer())
    .delete(`/api/admin/taste-notes/${id}`)
    .set(authHeaders(adminToken))
  assert.equal(response.status, 404)
  assert.equal(response.body.code, 'NOT_FOUND')

  assert.equal(await db.collection('auditlogs').countDocuments(), beforeAudit)
})

for (const operation of ['create', 'update']) {
  test(`concurrent deletion after ${operation} reads a taste note prevents a dangling binding`, { timeout: 15000 }, async (t) => {
    const created = await request(app.getHttpServer()).post('/api/admin/taste-notes')
      .set(authHeaders(adminToken)).send({ name: 'Race', slug: nextSlug() }).expect(201)
    const id = created.body.id
    const productId = await createProduct([])
    const service = app.get(TasteNotesService)
    const original = service.findByIds.bind(service)
    const entered = Promise.withResolvers()
    const release = Promise.withResolvers()
    let paused = false

    t.mock.method(service, 'findByIds', async (...args) => {
      const result = await original(...args)
      if (!paused && result.some((note) => String(note._id) === id)) {
        paused = true
        entered.resolve()
        await release.promise
      }
      return result
    })

    // Hold the product transaction after its snapshot read but before the
    // reference write. Removing lockReferences makes this test fail.
    const slug = nextSlug('product')
    const pending = (operation === 'create'
      ? request(app.getHttpServer()).post('/api/admin/products')
        .set(authHeaders(adminToken)).send({ name: 'Race', slug, tasteNoteIds: [id] })
      : request(app.getHttpServer()).patch(`/api/admin/products/${productId}`)
        .set(authHeaders(adminToken)).send({ tasteNoteIds: [id] }))
      .timeout(10000).then((response) => response)
    try {
      await Promise.race([entered.promise, pending.then(() => {
        throw new Error('Product request finished before reaching the concurrency barrier')
      })])
      await request(app.getHttpServer()).delete(`/api/admin/taste-notes/${id}`)
        .set(authHeaders(adminToken)).timeout(5000).expect(200)
      release.resolve()
      const response = await pending
      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'NOT_FOUND')
      assert.equal(await db.collection('products').countDocuments({ tasteNoteIds: new Types.ObjectId(id) }), 0)
      if (operation === 'create') {
        assert.equal(await db.collection('products').countDocuments({ slug }), 0)
      } else {
        const product = await db.collection('products').findOne({ _id: new Types.ObjectId(productId) })
        assert.deepEqual(product.tasteNoteIds, [])
      }
    } finally {
      release.resolve()
      await pending
    }
  })
}

test('OpenAPI usages and deletion responses match their actual JSON bodies', async () => {
  const spec = SwaggerModule.createDocument(app, new DocumentBuilder().build())
  const created = await request(app.getHttpServer()).post('/api/admin/taste-notes')
    .set(authHeaders(adminToken)).send({ name: 'Schema', slug: nextSlug() }).expect(201)
  for (const [path, method, url, schemaName] of [
    ['/api/admin/taste-notes/{id}/usages', 'get', `/api/admin/taste-notes/${created.body.id}/usages`, 'TasteNoteUsagesResponse'],
    ['/api/admin/taste-notes/{id}', 'delete', `/api/admin/taste-notes/${created.body.id}`, 'DeleteTasteNoteResponse'],
  ]) {
    const schema = spec.paths[path][method].responses['200'].content['application/json'].schema
    assert.equal(schema.$ref, `#/components/schemas/${schemaName}`)
    const response = await request(app.getHttpServer())[method](url).set(authHeaders(adminToken)).expect(200)
    const definition = spec.components.schemas[schemaName]
    assert.deepEqual(Object.keys(response.body).sort(), Object.keys(definition.properties).sort())
    assert.deepEqual(Object.keys(response.body).sort(), [...definition.required].sort())
    for (const [key, value] of Object.entries(response.body)) {
      assert.equal(typeof value, definition.properties[key].type)
    }
  }
})

test('audit failure rolls back deletion and all product bindings', async (t) => {
  const note = await request(app.getHttpServer()).post('/api/admin/taste-notes')
    .set(authHeaders(adminToken)).send({ name: 'Rollback', slug: nextSlug() }).expect(201)
  const id = new Types.ObjectId(note.body.id)
  const other = new Types.ObjectId()
  const productId = new Types.ObjectId(await createProduct([String(id), String(other)], 'archived'))
  const before = await db.collection('products').findOne({ _id: productId })
  const beforeNote = await db.collection('tastenotes').findOne({ _id: id })
  const audit = app.get(AuditService)
  const original = audit.record.bind(audit)
  t.mock.method(audit, 'record', async (entry, session) => {
    if (entry.action === 'taste-note.deleted') {
      throw new Error('Injected audit failure')
    }
    return original(entry, session)
  })
  await request(app.getHttpServer()).delete(`/api/admin/taste-notes/${id}`)
    .set(authHeaders(adminToken)).expect(500)
  assert.deepEqual(await db.collection('products').findOne({ _id: productId }), before)
  assert.deepEqual(await db.collection('tastenotes').findOne({ _id: id }), beforeNote)
  assert.equal(await db.collection('auditlogs').countDocuments({ action: 'taste-note.deleted', entityId: String(id) }), 0)
})
