import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

let directory
let api
let products
let media
let inventory
let cms
let administrators
let audit
let reservations
let dashboard
let calls
let replies
let redirects
const originalFetch = globalThis.fetch
const originalDocument = globalThis.document
const originalWindow = globalThis.window
const originalCookieName = process.env.NEXT_PUBLIC_CSRF_TOKEN_NAME

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'mokuren-catalog-test-'))
  for (const name of [
    'admin-auth',
    'catalog-request',
    'products',
    'media',
    'inventory',
    'cms',
    'administrators',
    'audit',
    'reservations',
    'dashboard',
  ]) {
    const source = await readFile(
      new URL(`../app/shared/api/requests/${name}.ts`, import.meta.url),
      'utf8'
    )
    const compiled = ts
      .transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
      })
      .outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'")
    await writeFile(join(directory, `${name}.mjs`), compiled)
  }
  api = await import(pathToFileURL(join(directory, 'catalog-request.mjs')))
  products = await import(pathToFileURL(join(directory, 'products.mjs')))
  media = await import(pathToFileURL(join(directory, 'media.mjs')))
  inventory = await import(pathToFileURL(join(directory, 'inventory.mjs')))
  cms = await import(pathToFileURL(join(directory, 'cms.mjs')))
  administrators = await import(pathToFileURL(join(directory, 'administrators.mjs')))
  audit = await import(pathToFileURL(join(directory, 'audit.mjs')))
  reservations = await import(pathToFileURL(join(directory, 'reservations.mjs')))
  dashboard = await import(pathToFileURL(join(directory, 'dashboard.mjs')))
})

beforeEach(() => {
  calls = []
  replies = []
  redirects = []
  process.env.NEXT_PUBLIC_CSRF_TOKEN_NAME = 'csrf_token'
  globalThis.document = { cookie: 'csrf_token=old-token' }
  globalThis.window = { location: { replace: (path) => redirects.push(path) } }
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options })
    const next = replies.shift()
    assert.ok(next, `Unexpected request: ${url}`)
    if (next.cookie) {
      document.cookie = next.cookie
    }
    if (next.error) {
      throw next.error
    }
    return new Response(next.status === 204 ? null : JSON.stringify(next.body || {}), {
      status: next.status || 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

after(async () => {
  globalThis.fetch = originalFetch
  globalThis.document = originalDocument
  globalThis.window = originalWindow
  if (originalCookieName === undefined) {
    delete process.env.NEXT_PUBLIC_CSRF_TOKEN_NAME
  } else {
    process.env.NEXT_PUBLIC_CSRF_TOKEN_NAME = originalCookieName
  }
  await rm(directory, { recursive: true, force: true })
})

test('refreshes rejected CSRF once, preserving the stock operation idempotency key', async () => {
  replies.push(
    { status: 403, body: { code: 'CSRF_REQUIRED', message: 'Token expired' } },
    { status: 204, cookie: 'csrf_token=new-token' },
    { body: { movementId: 'saved-movement' } }
  )
  const result = await inventory.recordStock('receipt', 'product-id', 500, 'Delivery', 'same-key')
  assert.equal(result.movementId, 'saved-movement')
  assert.equal(calls.length, 3)
  assert.equal(calls[1].url, '/api/admin/auth/csrf-token')
  assert.equal(calls[0].headers.get('X-CSRF-Token'), 'old-token')
  assert.equal(calls[2].headers.get('X-CSRF-Token'), 'new-token')
  assert.equal(calls[0].headers.get('Idempotency-Key'), 'same-key')
  assert.equal(calls[2].headers.get('Idempotency-Key'), 'same-key')
  assert.deepEqual(JSON.parse(calls[2].body), {
    productId: 'product-id',
    reason: 'Delivery',
    grams: 500,
  })
})

test('does not retry a stock conflict or uncertain network result', async () => {
  replies.push({
    status: 409,
    body: { code: 'INSUFFICIENT_STOCK', message: 'Not enough available stock' },
  })
  await assert.rejects(
    inventory.recordStock('write-off', 'product-id', 100, 'Damage', 'key'),
    /Not enough available stock/
  )
  assert.equal(calls.length, 1)
  replies.push({ error: new TypeError('Connection lost') })
  await assert.rejects(
    inventory.recordStock('receipt', 'product-id', 100, 'Delivery', 'key'),
    /Connection lost/
  )
  assert.equal(calls.length, 2)
})

test('ends a repeated CSRF rejection without a third mutation', async () => {
  replies.push(
    { status: 403, body: { code: 'CSRF_REQUIRED' } },
    { status: 204, cookie: 'csrf_token=new-token' },
    { status: 403, body: { code: 'CSRF_REQUIRED' } }
  )
  await assert.rejects(api.catalogRequest('products', { method: 'POST', body: '{}' }))
  assert.equal(calls.filter((call) => call.method === 'POST').length, 2)
})

test('bootstraps a missing security cookie before sending multipart data', async () => {
  document.cookie = ''
  replies.push({ status: 204, cookie: 'csrf_token=issued-token' }, { body: { id: 'image-id' } })
  const form = new FormData()
  form.append('file', new Blob(['image'], { type: 'image/png' }), 'tea.png')
  await media.uploadMedia(form)
  assert.equal(calls[0].url, '/api/admin/auth/csrf-token')
  assert.equal(calls[1].body, form)
  assert.equal(calls[1].headers.has('Content-Type'), false)
  assert.equal(calls[1].headers.get('X-CSRF-Token'), 'issued-token')
  assert.equal(calls[1].credentials, 'include')
})

test('redirects expired sessions and required password changes', async () => {
  replies.push({ status: 401, body: { code: 'UNAUTHORIZED' } })
  await assert.rejects(products.listProducts({}))
  replies.push({ status: 403, body: { code: 'PASSWORD_CHANGE_REQUIRED' } })
  await assert.rejects(products.listProducts({}))
  assert.deepEqual(redirects, ['/login', '/change-password'])
})

test('shows publication details returned by the server', async () => {
  replies.push({
    status: 409,
    body: {
      code: 'INVALID_STATUS_TRANSITION',
      message: 'Product is not ready',
      details: [{ message: 'A category is required' }, { message: 'An image is required' }],
    },
  })
  await assert.rejects(
    products.changeProductStatus('product-id', 'publish'),
    /Product is not ready A category is required An image is required/
  )
  assert.equal(calls.length, 1)
})

test('omits an unset status filter and preserves an explicit zero stock target', async () => {
  replies.push({ body: { items: [] } }, { body: { movementId: 'zero-count' } })
  await products.listProducts({ search: 'milk & tea', page: 2 })
  const query = new URL(calls[0].url, 'http://localhost').searchParams
  assert.equal(query.has('status'), false)
  assert.equal(query.get('search'), 'milk & tea')
  assert.equal(query.get('page'), '2')
  await inventory.recordStock('adjust', 'product-id', 0, 'Stock count', 'count-key')
  assert.deepEqual(JSON.parse(calls[1].body), {
    productId: 'product-id',
    reason: 'Stock count',
    targetPhysicalGrams: 0,
  })
})

test('preserves cancellation signals and avoids caching private data', async () => {
  const controller = new AbortController()
  replies.push({ body: { items: [] } })
  await products.listProducts({}, controller.signal)
  assert.equal(calls[0].signal.aborted, false)
  controller.abort()
  assert.equal(calls[0].signal.aborted, true)
  assert.equal(calls[0].cache, 'no-store')
  assert.equal(calls[0].credentials, 'include')
})

test('CMS draft carries its loaded version and never retries a stale save', async () => {
  const block = { pageKey: 'home', blockKey: 'home.hero', draftVersion: 7 }
  replies.push({ status: 409, body: { code: 'STALE_VERSION', message: 'Draft changed' } })
  await assert.rejects(
    cms.saveCmsDraft(block, { title: 'Tea stories' }),
    (error) => error.code === 'STALE_VERSION'
  )
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/api/admin/cms/blocks/home/home.hero/draft')
  assert.equal(calls[0].method, 'PATCH')
  assert.equal(calls[0].headers.get('X-CSRF-Token'), 'old-token')
  assert.deepEqual(JSON.parse(calls[0].body), {
    pageKey: 'home',
    blockKey: 'home.hero',
    content: { title: 'Tea stories' },
    expectedDraftVersion: 7,
  })
})

test('CMS publishing and restore send matching route and body keys', async () => {
  const block = { pageKey: 'about', blockKey: 'about.content' }
  replies.push(
    { status: 201, body: { publishedVersion: 3 } },
    { status: 201, body: { draftVersion: 9 } }
  )
  const published = await cms.publishCmsBlock(block)
  const restored = await cms.restoreCmsRevision(block, 'revision-id')
  assert.equal(published.publishedVersion, 3)
  assert.equal(restored.draftVersion, 9)
  assert.equal(calls[0].url, '/api/admin/cms/blocks/about/about.content/publish')
  assert.equal(
    calls[1].url,
    '/api/admin/cms/blocks/about/about.content/revisions/revision-id/restore'
  )
  assert.deepEqual(JSON.parse(calls[0].body), block)
  assert.deepEqual(JSON.parse(calls[1].body), { ...block, revisionId: 'revision-id' })
})

test('CMS preview uses the selected saved block and read requests are cancellable', async () => {
  const block = { pageKey: 'home', blockKey: 'home.hero' }
  const controller = new AbortController()
  replies.push(
    { body: { items: [] } },
    { body: { items: [] } },
    { body: { pageKey: 'home', blocks: { 'home.hero': { title: 'Saved draft' } } } }
  )
  await cms.listCmsBlocks(controller.signal)
  await cms.listCmsRevisions(block, controller.signal)
  const preview = await cms.previewCmsPage(block)
  assert.equal(calls[0].url, '/api/admin/cms/blocks')
  assert.equal(calls[1].url, '/api/admin/cms/blocks/home/home.hero/revisions')
  assert.equal(calls[2].url, '/api/admin/cms/preview/home/home.hero')
  assert.equal(preview.blocks['home.hero'].title, 'Saved draft')
  controller.abort()
  assert.equal(calls[0].signal.aborted, true)
  assert.equal(calls[1].signal.aborted, true)
})

test('CMS publication is not retried after an uncertain response', async () => {
  replies.push({ error: new TypeError('Connection lost') })
  await assert.rejects(cms.publishCmsBlock({ pageKey: 'home', blockKey: 'home.hero' }))
  assert.equal(calls.length, 1)
})

test('administrator changes use CSRF and preserve explicit access deactivation', async () => {
  replies.push(
    { body: { user: { id: 'new-admin' }, temporaryPassword: 'issued-once' } },
    { body: { id: 'new-admin', isActive: false } },
    { body: { revokedCount: 2 } }
  )
  const created = await administrators.createAdministrator({
    login: 'tea-admin',
    displayName: 'Tea Admin',
  })
  assert.equal(created.temporaryPassword, 'issued-once')
  await administrators.updateAdministrator('new-admin', { isActive: false })
  await administrators.revokeAdministratorSessions('new-admin')
  assert.deepEqual(
    calls.map((call) => [call.url, call.method]),
    [
      ['/api/admin/users', 'POST'],
      ['/api/admin/users/new-admin', 'PATCH'],
      ['/api/admin/users/new-admin/revoke-sessions', 'POST'],
    ]
  )
  assert.deepEqual(JSON.parse(calls[1].body), { isActive: false })
  for (const call of calls) {
    assert.equal(call.headers.get('X-CSRF-Token'), 'old-token')
    assert.equal(call.credentials, 'include')
    assert.equal(call.cache, 'no-store')
  }
})

test('password resets never repeat after an uncertain result or a rate-limit response', async () => {
  replies.push({ error: new TypeError('Connection lost') })
  await assert.rejects(administrators.resetAdministratorPassword('admin-id'), /Connection lost/)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/api/admin/users/admin-id/reset-password')
  replies.push({ status: 429, body: { code: 'RATE_LIMITED', message: 'Try again later' } })
  await assert.rejects(administrators.resetAdministratorPassword('admin-id'), /Try again later/)
  assert.equal(calls.length, 2)
})

test('administration lists encode filters, retain date bounds and support cancellation', async () => {
  const controller = new AbortController()
  replies.push({ body: { items: [] } }, { body: { items: [] } })
  await administrators.listAdministrators({ page: 3, search: 'tea & admin' }, controller.signal)
  const usersQuery = new URL(calls[0].url, 'http://localhost').searchParams
  assert.equal(usersQuery.get('page'), '3')
  assert.equal(usersQuery.get('search'), 'tea & admin')
  const filters = {
    actorId: 'actor-id',
    action: 'admin-user.updated',
    entityType: 'admin-user',
    entityId: 'resource & id',
    from: '2026-10-01T00:00:00.000Z',
    to: '2026-10-31T23:59:59.000Z',
  }
  await audit.listAuditEntries({ ...filters, page: 2 }, controller.signal)
  const auditQuery = new URL(calls[1].url, 'http://localhost').searchParams
  for (const [key, value] of Object.entries(filters)) {
    assert.equal(auditQuery.get(key), value)
  }
  assert.equal(auditQuery.get('page'), '2')
  controller.abort()
  for (const call of calls) {
    assert.equal(call.signal.aborted, true)
    assert.equal(call.cache, 'no-store')
  }
})

test('reservation filters and overview use authenticated cancellable reads', async () => {
  const controller = new AbortController()
  replies.push({ body: { items: [] } }, { body: { reservations: { new: 3 } } })
  const filters = {
    status: 'ready',
    source: 'website',
    customerName: 'Tea & Anna',
    customerPhone: '+37529',
    from: '2026-10-01T00:00:00.000Z',
    to: '2026-10-31T23:59:59.000Z',
  }
  await reservations.listReservations({ ...filters, page: 2 }, controller.signal)
  const params = new URL(calls[0].url, 'http://localhost').searchParams
  for (const [key, value] of Object.entries(filters)) {
    assert.equal(params.get(key), value)
  }
  assert.equal(params.get('page'), '2')
  const result = await dashboard.getDashboard(controller.signal)
  assert.equal(result.reservations.new, 3)
  assert.equal(calls[1].url, '/api/admin/dashboard')
  controller.abort()
  for (const call of calls) {
    assert.equal(call.signal.aborted, true)
    assert.equal(call.cache, 'no-store')
    assert.equal(call.credentials, 'include')
  }
})

test('reservation edits send customer and item inputs and cancellation preserves return confirmation', async () => {
  const input = {
    customerName: 'Anna',
    customerPhone: '+375291234567',
    lines: [{ productId: 'tea', variantId: '50g', quantity: 2 }],
  }
  replies.push(
    { body: { id: 'reservation' } },
    { body: { id: 'reservation' } },
    { body: { status: 'cancelled' } }
  )
  await reservations.createReservation(input)
  await reservations.updateReservation('reservation', input)
  await reservations.transitionReservation('reservation', 'cancel', true)
  assert.equal(calls[0].url, '/api/admin/reservations')
  assert.equal(calls[1].method, 'PATCH')
  assert.deepEqual(JSON.parse(calls[1].body), input)
  assert.equal(calls[2].url, '/api/admin/reservations/reservation/cancel')
  assert.deepEqual(JSON.parse(calls[2].body), { teaReturned: true })
  for (const call of calls) {
    assert.equal(call.headers.get('X-CSRF-Token'), 'old-token')
  }
})

test('reservation status conflicts and uncertain creation are not retried', async () => {
  replies.push({
    status: 409,
    body: { code: 'INSUFFICIENT_STOCK', message: 'Not enough available stock' },
  })
  await assert.rejects(
    reservations.transitionReservation('reservation', 'confirm'),
    /Not enough available stock/
  )
  assert.equal(calls.length, 1)
  replies.push({ error: new TypeError('Connection lost') })
  await assert.rejects(
    reservations.createReservation({ customerName: 'Anna', customerPhone: '+37529', lines: [] }),
    /Connection lost/
  )
  assert.equal(calls.length, 2)
})
