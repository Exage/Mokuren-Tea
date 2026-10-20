import assert from 'node:assert/strict'
import { after, afterEach, before, test } from 'node:test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { env, execPath } from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import { tmpdir } from 'node:os'
import { Types } from 'mongoose'
import request from 'supertest'
import { TasteNotesMigrationService } from '../../dist/taste-notes/taste-notes-migration.service.js'
import { authHeaders, createAdmin, seedReferences, startTestApp, stopTestApp } from './setup.mjs'

let app, replSet, db, token, migration
const runFile = promisify(execFile)
const cli = fileURLToPath(new URL('../../dist/taste-notes/taste-notes-migration.cli.js', import.meta.url))

before(async () => {
  const started = await startTestApp('mokuren_taste_notes_legacy_test')
  ;({ app, replSet, db } = started)
  ;({ token } = await createAdmin(db))
  migration = new TasteNotesMigrationService(db)
})

afterEach(async () => {
  await db.collection('tastenotes').deleteMany({})
  await db.collection('products').deleteMany({})
})

after(async () => {
  await stopTestApp(app, replSet)
})

test('CLI report is read-only and backfill makes existing seed records readable and editable', async () => {
  const refs = await seedReferences(db)
  const before = await db.collection('tastenotes').find({}).toArray()
  const indexes = await db.collection('tastenotes').listIndexes().toArray()
  const options = {
    cwd: tmpdir(),
    env: { ...env, MONGODB_URI: replSet.getUri(db.databaseName) },
  }
  const report = JSON.parse((await runFile(execPath, [cli, 'report'], options)).stdout)
  assert.equal(report.scanned, 2)
  assert.equal(report.technicalIssues.length, 2)
  assert.deepEqual(await db.collection('tastenotes').find({}).toArray(), before)
  assert.deepEqual(await db.collection('tastenotes').listIndexes().toArray(), indexes)

  const unavailable = await request(app.getHttpServer()).get('/api/admin/taste-notes')
    .set(authHeaders(token)).expect(503)
  assert.equal(unavailable.body.code, 'TASTE_NOTES_MIGRATION_REQUIRED')

  const result = JSON.parse((await runFile(execPath, [cli, 'backfill'], options)).stdout)
  assert.equal(result.updated, 2)
  assert.deepEqual(result.remainingIssues.technicalIssues, [])
  const response = await request(app.getHttpServer()).get('/api/admin/taste-notes')
    .set(authHeaders(token)).expect(200)
  assert.equal(response.body.items.length, 2)
  for (const note of response.body.items) {
    assert.equal(note.createdAt, result.backfillAt)
    assert.equal(note.updatedAt, result.backfillAt)
    assert.equal(note.sortOrder, 0)
  }
  await request(app.getHttpServer()).patch(`/api/admin/taste-notes/${refs.tasteFloral}`)
    .set(authHeaders(token)).send({ name: 'Floral updated' }).expect(200)
})

test('backfill is idempotent and preserves names, slugs, links and valid technical values', async () => {
  const id = new Types.ObjectId()
  const createdAt = new Date('2026-01-01T00:00:00Z')
  await db.collection('tastenotes').insertOne({
    _id: id, name: 'Legacy', slug: 'legacy', createdAt,
    updatedAt: null, sortOrder: 8, referenceRevision: 12,
  })
  await db.collection('products').insertOne({ tasteNoteIds: [id] })
  const products = await db.collection('products').find({}).toArray()
  const first = await migration.backfill()
  assert.equal(first.updated, 1)
  const note = await db.collection('tastenotes').findOne({ _id: id })
  assert.deepEqual(note, {
    _id: id, name: 'Legacy', slug: 'legacy', createdAt,
    updatedAt: first.backfillAt, sortOrder: 8, referenceRevision: 12,
  })
  assert.equal((await migration.backfill()).updated, 0)
  assert.deepEqual(await db.collection('tastenotes').findOne({ _id: id }), note)
  assert.deepEqual(await db.collection('products').find({}).toArray(), products)
})

test('report identifies normalized collisions and dangling links without changing business data', async () => {
  await db.collection('tastenotes').insertMany([
    { name: 'Floral', slug: 'floral' },
    { name: 'Other', slug: ' FLORAL ' },
    { name: '', slug: 'bad slug' },
  ])
  const missing = new Types.ObjectId()
  const product = await db.collection('products').insertOne({ tasteNoteIds: [missing] })
  const before = await db.collection('tastenotes').find({}).toArray()
  const report = await migration.report()
  assert.equal(report.slugCollisions.length, 1)
  assert.equal(report.slugCollisions[0].slug, 'floral')
  assert.equal(report.invalidBusinessFields.length, 1)
  assert.equal(report.nonNormalizedSlugs.length, 1)
  assert.deepEqual(report.danglingReferences, [{ productId: String(product.insertedId), tasteNoteId: String(missing) }])
  assert.deepEqual(await db.collection('tastenotes').find({}).toArray(), before)
})

test('invalid non-null technical values remain visible in the report and are not overwritten', async () => {
  const entry = { name: 'Invalid', slug: 'invalid', createdAt: 'unknown', updatedAt: new Date(), sortOrder: -1, referenceRevision: 'unknown' }
  const { insertedId } = await db.collection('tastenotes').insertOne(entry)
  const result = await migration.backfill()
  assert.equal(result.updated, 0)
  assert.deepEqual(result.remainingIssues.technicalIssues, [{
    id: String(insertedId), fields: ['createdAt', 'sortOrder', 'referenceRevision'],
  }])
  assert.deepEqual(await db.collection('tastenotes').findOne({ _id: insertedId }), { ...entry, _id: insertedId })
})
