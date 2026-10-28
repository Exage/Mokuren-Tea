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
let calls
let replies
let redirects
const originalFetch = globalThis.fetch
const originalDocument = globalThis.document
const originalWindow = globalThis.window
const originalCookieName = process.env.NEXT_PUBLIC_CSRF_TOKEN_NAME

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'mokuren-catalog-test-'))
  for (const name of ['admin-auth', 'catalog-request', 'products', 'media', 'inventory']) {
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
