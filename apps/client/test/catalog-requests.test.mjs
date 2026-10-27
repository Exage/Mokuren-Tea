import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { getCatalogOptions, getCatalogProducts } from '../app/shared/api/requests/catalog.ts'

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

test('catalog query sends filters and page to the public API', async () => {
  let url
  const signal = new AbortController().signal
  globalThis.fetch = async (input, options) => {
    url = new URL(input)
    assert.equal(options.signal, signal)
    return new Response(JSON.stringify({ items: [], pagination: { page: 2 } }), { status: 200 })
  }
  await getCatalogProducts(
    'https://example.test/api/',
    {
      search: 'green tea',
      category: 'green',
      tastes: ['one', 'two'],
      minPrice: 0,
      maxPrice: 50,
      sort: 'price-asc',
      page: 2,
    },
    signal
  )
  assert.equal(url.pathname, '/api/products')
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    search: 'green tea',
    category: 'green',
    tastes: 'one,two',
    minPrice: '0',
    maxPrice: '50',
    sort: 'price-asc',
    page: '2',
  })
})

test('catalog API failures reject rather than returning an empty catalog', async () => {
  globalThis.fetch = async () => new Response('{}', { status: 500 })
  await assert.rejects(getCatalogProducts('https://example.test/api', {}), /HTTP 500/)
  await assert.rejects(getCatalogOptions('https://example.test/api', 'categories'), /HTTP 500/)
})
