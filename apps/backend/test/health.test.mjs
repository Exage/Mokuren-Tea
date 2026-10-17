import 'reflect-metadata'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { HealthController } from '../dist/health/health.controller.js'

test('reports a healthy database only after a successful ping', async () => {
  const controller = new HealthController({
    readyState: 1,
    db: {
      command: async (command) => {
        assert.deepEqual(command, { ping: 1 })
        return { ok: 1 }
      },
    },
  })
  assert.deepEqual(await controller.check(), { status: 'ok', database: 'up' })
})

test('returns 503 when disconnected or a database ping fails', async () => {
  const connections = [
    { readyState: 0 },
    {
      readyState: 1,
      db: {
        command: async () => {
          throw new Error('Internal connection details')
        },
      },
    },
  ]

  for (const connection of connections) {
    await assert.rejects(new HealthController(connection).check(), (error) => {
      assert.equal(error.getStatus(), 503)
      assert.deepEqual(error.getResponse(), { status: 'error', database: 'down' })
      return true
    })
  }
})
