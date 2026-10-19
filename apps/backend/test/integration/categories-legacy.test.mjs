import assert from 'node:assert/strict'
import { after, afterEach, before, test } from 'node:test'
import { Types } from 'mongoose'
import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { env, execPath } from 'node:process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import request from 'supertest'
import { authHeaders, createAdmin, startTestApp, stopTestApp } from './setup.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

let app
let replSet
let db
let adminToken

let slugCounter = 0
function nextSlug(prefix = 'legacy') {
  return `${prefix}-${Date.now()}-${slugCounter++}`
}

let mongoUri

before(async () => {
  const started = await startTestApp('mokuren_categories_legacy_test')
  app = started.app
  replSet = started.replSet
  db = started.db
  ;({ token: adminToken } = await createAdmin(db))
  mongoUri = replSet.getUri(db.databaseName)
})

afterEach(async () => {
  await db.collection('categories').deleteMany({})
})

after(async () => {
  await stopTestApp(app, replSet)
})

function runCli(args = [], envOverrides = {}) {
  try {
    const stdout = execFileSync(
      'node',
      [join(__dirname, '../../dist/categories/categories-migration.cli.js'), ...args],
      {
        env: {
          ...env,
          ...envOverrides,
        },
        encoding: 'utf8',
      }
    )
    return { stdout, stderr: '', code: 0 }
  } catch (error) {
    return {
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
      code: error.status ?? 1,
    }
  }
}

async function runBackfill() {
  return runCli(['backfill'], { MONGODB_URI: mongoUri, NODE_ENV: 'test' })
}

test('compiled CLI loads the backend-root .env for report and backfill from another directory', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'mokuren-category-cli-env-'))

  try {
    const cliDirectory = join(fixtureRoot, 'dist/categories')
    await mkdir(cliDirectory, { recursive: true })
    const cliPath = join(cliDirectory, 'categories-migration.cli.mjs')
    await copyFile(join(__dirname, '../../dist/categories/categories-migration.cli.js'), cliPath)
    await symlink(join(__dirname, '../../node_modules'), join(fixtureRoot, 'node_modules'), 'dir')
    // Keep both configuration and writes isolated from the developer's .env/database.
    await writeFile(join(fixtureRoot, '.env'), `MONGODB_URI=${mongoUri}\n`)
    const childEnv = { ...env, NODE_ENV: 'test' }
    delete childEnv.MONGODB_URI

    const legacyId = new Types.ObjectId()
    await db.collection('categories').insertOne({
      _id: legacyId,
      name: 'CLI Environment Category',
      slug: nextSlug('cli-env'),
    })

    const options = { cwd: cliDirectory, env: childEnv, encoding: 'utf8' }
    const report = execFileSync(execPath, [cliPath, 'report'], options)
    assert.ok(report.includes('Categories scanned: 1'))
    const unchanged = await db.collection('categories').findOne({ _id: legacyId })
    assert.equal(unchanged.createdAt, undefined)

    const backfill = execFileSync(execPath, [cliPath, 'backfill'], options)
    assert.ok(backfill.includes('Backfill complete: 1 category(ies) updated'))
    const updated = await db.collection('categories').findOne({ _id: legacyId })
    assert.ok(updated.createdAt instanceof Date)
    assert.ok(updated.updatedAt instanceof Date)
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true })
  }
})

test('legacy category without timestamps causes admin list to fail with 500', async () => {
  const slug = nextSlug()
  await db.collection('categories').insertOne({
    name: 'Legacy Category',
    slug,
  })

  const response = await request(app.getHttpServer())
    .get('/api/admin/categories')
    .set(authHeaders(adminToken))

  assert.equal(response.status, 500)
})

test('backfill populates missing timestamps and technical fields on legacy records', async () => {
  const slug = nextSlug()
  const legacyId = new Types.ObjectId()
  const before = new Date()
  await db.collection('categories').insertOne({
    _id: legacyId,
    name: 'Legacy Category',
    slug,
  })

  const beforeDoc = await db.collection('categories').findOne({ _id: legacyId })
  assert.ok(!beforeDoc.createdAt)
  assert.ok(!beforeDoc.updatedAt)
  assert.ok(!beforeDoc.sortOrder)
  assert.ok(!beforeDoc.referenceRevision)

  const { stdout, code } = await runBackfill()
  assert.equal(code, 0)
  assert.ok(stdout.includes('Backfill complete'), `expected backfill summary in stdout: ${stdout}`)

  const afterDoc = await db.collection('categories').findOne({ _id: legacyId })
  assert.ok(afterDoc.createdAt, 'expected createdAt to be backfilled')
  assert.ok(afterDoc.updatedAt, 'expected updatedAt to be backfilled')
  assert.equal(afterDoc.sortOrder, 0, 'expected sortOrder default 0')
  assert.equal(afterDoc.referenceRevision, 0, 'expected referenceRevision default 0')
  assert.ok(afterDoc.createdAt >= before, 'expected backfill timestamp to be on/after migration start')
  assert.ok(afterDoc.updatedAt >= before, 'expected backfill timestamp to be on/after migration start')
})

test('backfill does not reset existing dates, order, or referenceRevision', async () => {
  const slug = nextSlug()
  const legacyId = new Types.ObjectId()
  const knownCreated = new Date('2026-01-05T00:00:00.000Z')
  const knownUpdated = new Date('2026-02-01T00:00:00.000Z')
  await db.collection('categories').insertOne({
    _id: legacyId,
    name: 'Legacy Category',
    slug,
    createdAt: knownCreated,
    updatedAt: knownUpdated,
    sortOrder: 7,
    referenceRevision: 3,
  })

  await runBackfill()

  const doc = await db.collection('categories').findOne({ _id: legacyId })
  assert.equal(doc.createdAt.getTime(), knownCreated.getTime())
  assert.equal(doc.updatedAt.getTime(), knownUpdated.getTime())
  assert.equal(doc.sortOrder, 7)
  assert.equal(doc.referenceRevision, 3)
})

test('backfill is idempotent: repeated run does not rewrite valid data', async () => {
  const slug = nextSlug()
  const legacyId = new Types.ObjectId()
  const backfillTime = new Date('2026-03-01T00:00:00.000Z')
  await db.collection('categories').insertOne({
    _id: legacyId,
    name: 'Legacy Category',
    slug,
    createdAt: backfillTime,
    updatedAt: backfillTime,
    sortOrder: 5,
    referenceRevision: 1,
  })

  await runBackfill()
  await runBackfill()

  const doc = await db.collection('categories').findOne({ _id: legacyId })
  assert.equal(doc.createdAt.getTime(), backfillTime.getTime())
  assert.equal(doc.updatedAt.getTime(), backfillTime.getTime())
  assert.equal(doc.sortOrder, 5)
  assert.equal(doc.referenceRevision, 1)
})

test('admin list works after backfill for a legacy category', async () => {
  const slug = nextSlug()
  const legacyId = new Types.ObjectId()
  await db.collection('categories').insertOne({
    _id: legacyId,
    name: 'Legacy Category',
    slug,
  })

  await runBackfill()

  const response = await request(app.getHttpServer())
    .get('/api/admin/categories')
    .set(authHeaders(adminToken))
  assert.equal(response.status, 200)
  assert.equal(response.body.items.length, 1)
  assert.equal(response.body.items[0].id, String(legacyId))
  assert.equal(response.body.items[0].slug, slug)
  assert.ok(response.body.items[0].createdAt)
  assert.ok(response.body.items[0].updatedAt)
})
