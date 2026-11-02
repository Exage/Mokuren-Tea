import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ReservationSubmission,
  ReservationRequestError,
} from '../app/shared/api/requests/reservations.ts'

// Run against: postman simulation run postman/simulations/storefront-reservations/storefront-reservations.sim.yaml --port 4515 --no-history
const enabled = Boolean(process.env.RESERVATION_SIMULATION_URL)
if (enabled) {
  process.env.NEXT_PUBLIC_API_URL = process.env.RESERVATION_SIMULATION_URL
}
const input = {
  source: 'website',
  customerName: 'Simulation customer',
  customerPhone: '+375291234567',
  lines: [{ productId: '64f000000000000000000001', variantId: 'v_sencha_50', quantity: 2 }],
}

test(
  'real HTTP creation returns a receipt, while selected failures preserve the correct retry state',
  { skip: !enabled },
  async () => {
    const result = await new ReservationSubmission().submit(input)
    assert.equal(result.status, 'new')
    assert.equal(result.totalAmount, 43.8)
    for (const [variantId, uncertain, refreshProducts] of [
      ['v_unavailable', false, true],
      ['v_throttled', false, false],
      ['v_invalid_response', true, false],
    ]) {
      const submission = new ReservationSubmission()
      await assert.rejects(
        submission.submit({ ...input, lines: [{ ...input.lines[0], variantId }] }),
        (error) => {
          assert.ok(error instanceof ReservationRequestError)
          assert.equal(error.uncertain, uncertain)
          assert.equal(error.refreshProducts, refreshProducts)
          return true
        }
      )
      assert.equal(submission.hasUncertainRequest, uncertain)
    }
  }
)

test(
  'a committed write with a lost response replays the same reservation over real HTTP',
  { skip: !enabled },
  async () => {
    const submission = new ReservationSubmission()
    const request = { ...input, lines: [{ ...input.lines[0], variantId: 'v_lost_response' }] }
    await assert.rejects(submission.submit(request), (error) => error.uncertain)
    assert.equal(submission.hasUncertainRequest, true)
    const receipt = await submission.submit(request)
    assert.equal(receipt.status, 'new')
    assert.ok(receipt.number.startsWith('R-'))
    assert.equal(submission.hasUncertainRequest, false)
  }
)
