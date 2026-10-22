import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseCorsOrigins } from '../dist/config/cors.js'

test('CORS defaults to no cross-origin access and accepts an exact origin list', () => {
  assert.deepEqual(parseCorsOrigins(undefined), [])
  assert.deepEqual(parseCorsOrigins(''), [])
  assert.deepEqual(
    parseCorsOrigins('https://admin.example.com, http://localhost:3000'),
    ['https://admin.example.com', 'http://localhost:3000'],
  )
})

test('CORS rejects wildcard, opaque, path-bearing, and credential-bearing origins', () => {
  for (const value of ['*', 'https://*.example.com', 'null', 'file:///tmp', 'https://example.com/path', 'https://u:p@example.com', 'https://example.com,', 42]) {
    assert.throws(() => parseCorsOrigins(value), /CORS_ORIGINS/)
  }
})
