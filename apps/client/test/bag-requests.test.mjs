import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { getBagProducts } from '../app/shared/api/requests/bag.ts'

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

test('bag products are looked up by deduplicated IDs with uncached, abortable requests', async () => {
  const signal = new AbortController().signal
  globalThis.fetch = async (input, options) => {
    const url = new URL(input)
    assert.equal(url.pathname, '/api/products/by-ids')
    assert.equal(url.searchParams.get('ids'), 'one,two')
    assert.equal(options.cache, 'no-store')
    assert.equal(options.signal, signal)
    return new Response(JSON.stringify([{ id: 'one' }]))
  }
  assert.deepEqual(await getBagProducts(['one', 'two', 'one'], signal), [{ id: 'one' }])
})

test('empty bags make no requests and network failures are not treated as unavailable products', async () => {
  globalThis.fetch = async () => {
    throw new Error('Unexpected request')
  }
  assert.deepEqual(await getBagProducts([]), [])
  globalThis.fetch = async () => new Response('{}', { status: 503 })
  await assert.rejects(getBagProducts(['one']), /HTTP 503/)
})
