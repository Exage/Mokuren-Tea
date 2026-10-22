import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import request from 'supertest'
import { startTestApp, stopTestApp } from './setup.mjs'

let app
let replSet

before(async () => {
  ;({ app, replSet } = await startTestApp('mokuren_public_reservations_rate_test', {
    config: { RATE_LIMIT_MAX: '2', RATE_LIMIT_WINDOW_MS: '60000' },
  }))
})

after(async () => {
  await stopTestApp(app, replSet)
})

test('public reservation form returns 429 after the configured request limit', async () => {
  const statuses = []
  for (let index = 0; index < 3; index += 1) {
    const response = await request(app.getHttpServer()).post('/api/public/reservations').send({})
    statuses.push(response.status)
    if (index < 2) {
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.ok(response.body.details.length > 0)
    }
    if (index === 2) {
      assert.equal(response.body.code, 'RATE_LIMITED')
    }
  }
  assert.deepEqual(statuses, [400, 400, 429])
  const login = await request(app.getHttpServer()).post('/api/admin/auth/login').send({})
  assert.notEqual(login.status, 429, 'form traffic must not exhaust the login limit')
})
