import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import {
  ReservationSubmission,
  ReservationRequestError,
} from '../app/shared/api/requests/reservations.ts'

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})
const input = {
  source: 'website',
  customerName: 'Test customer',
  customerPhone: '+375291234567',
  lines: [{ productId: '64f000000000000000000001', variantId: 'v_sencha_50', quantity: 2 }],
}
const receipt = {
  id: '64f000000000000000000010',
  number: 'R-000001',
  status: 'new',
  totalAmount: 43.8,
}
const response = () => new Response(JSON.stringify(receipt), { status: 201 })

test('duplicate clicks share one request and successful submissions cannot run again', async () => {
  let release
  const calls = []
  globalThis.fetch = (url, options) => {
    calls.push({ url, options })
    return new Promise((resolve) => {
      release = () => resolve(response())
    })
  }
  const submission = new ReservationSubmission()
  const first = submission.submit(input)
  const second = submission.submit(input)
  assert.equal(first, second)
  assert.equal(submission.isSubmitting, true)
  assert.equal(calls.length, 1)
  const call = calls[0]
  assert.ok(call.url.endsWith('/api/public/reservations'))
  assert.equal(call.options.method, 'POST')
  assert.equal(call.options.headers['Content-Type'], 'application/json')
  assert.ok(call.options.headers['Idempotency-Key'])
  assert.deepEqual(JSON.parse(call.options.body), input)
  release()
  assert.deepEqual(await first, receipt)
  assert.equal(submission.isSubmitting, false)
  assert.deepEqual(await submission.submit(input), receipt)
  assert.equal(calls.length, 1)
})

test('an uncertain write keeps its original key and payload even after throttling or attempted edits', async () => {
  const calls = []
  globalThis.fetch = async (_, options) => {
    calls.push(options)
    if (calls.length === 1) {
      throw new TypeError('Network disconnected after write')
    }
    if (calls.length === 2) {
      return new Response('{}', { status: 429 })
    }
    return response()
  }
  const submission = new ReservationSubmission()
  const original = structuredClone(input)
  await assert.rejects(
    submission.submit(original),
    (error) => error instanceof ReservationRequestError && error.uncertain
  )
  original.lines[0].quantity = 9
  assert.equal(submission.hasUncertainRequest, true)
  await assert.rejects(submission.submit(original), /Too many requests/)
  assert.equal(submission.hasUncertainRequest, true)
  assert.deepEqual(await submission.submit(original), receipt)
  assert.equal(new Set(calls.map((call) => call.headers['Idempotency-Key'])).size, 1)
  assert.ok(calls.every((call) => call.body === JSON.stringify(input)))
  assert.equal(submission.hasUncertainRequest, false)
})

test('a definite stock rejection allows corrections with a new idempotency key', async () => {
  const calls = []
  globalThis.fetch = async (_, options) => {
    calls.push(options)
    return calls.length === 1
      ? new Response(JSON.stringify({ code: 'INSUFFICIENT_STOCK' }), { status: 409 })
      : response()
  }
  const submission = new ReservationSubmission()
  await assert.rejects(
    submission.submit(input),
    (error) => !error.uncertain && error.refreshProducts
  )
  assert.equal(submission.hasUncertainRequest, false)
  const corrected = { ...input, lines: [{ ...input.lines[0], quantity: 1 }] }
  await submission.submit(corrected)
  assert.notEqual(calls[0].headers['Idempotency-Key'], calls[1].headers['Idempotency-Key'])
  assert.deepEqual(JSON.parse(calls[1].body), corrected)
})

test('server, malformed-success, and in-flight responses preserve the request for safe retry', async () => {
  for (const makeResponse of [
    () => new Response('<html>Unavailable</html>', { status: 503 }),
    () => new Response('{}', { status: 201 }),
    () => new Response(JSON.stringify({ code: 'IDEMPOTENCY_IN_FLIGHT' }), { status: 409 }),
  ]) {
    globalThis.fetch = async () => makeResponse()
    const submission = new ReservationSubmission()
    await assert.rejects(submission.submit(input), (error) => error.uncertain)
    assert.equal(submission.hasUncertainRequest, true)
  }
})
