import type { ReservationInput, ReservationReceipt } from '../types/reservations'

export class ReservationRequestError extends Error {
  readonly uncertain: boolean
  readonly refreshProducts: boolean

  constructor(message: string, uncertain: boolean, refreshProducts = false) {
    super(message)
    this.name = 'ReservationRequestError'
    this.uncertain = uncertain
    this.refreshProducts = refreshProducts
  }
}

export async function createReservation(
  input: ReservationInput,
  idempotencyKey: string
): Promise<ReservationReceipt> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
  let response: Response
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, '')}/public/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(input),
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    })
  } catch {
    throw new ReservationRequestError(
      'We could not confirm whether your request was received. Keep this page open and try again to check the same request safely.',
      true
    )
  }

  const body: unknown = await response.json().catch(() => null)
  const code = body && typeof body === 'object' && 'code' in body ? body.code : undefined
  if (!response.ok) {
    if (code === 'IDEMPOTENCY_IN_FLIGHT') {
      throw new ReservationRequestError(
        'Your request is still being processed. Please wait a moment and try again.',
        true
      )
    }
    if (response.status >= 500 || response.status === 408 || code === 'IDEMPOTENCY_CONFLICT') {
      throw new ReservationRequestError(
        'We could not confirm your reservation. Please try again to check the same request safely.',
        true
      )
    }
    if (response.status === 429) {
      throw new ReservationRequestError(
        'Too many requests. Please wait a moment before trying again.',
        false
      )
    }
    if (response.status === 409 || response.status === 404) {
      throw new ReservationRequestError(
        'Some teas or sizes are no longer available in the requested quantity. Please review your bag and try again.',
        false,
        true
      )
    }
    throw new ReservationRequestError(
      response.status === 400
        ? 'Please check your name, phone number, and tea selection before trying again.'
        : 'Your reservation could not be submitted. Please try again later.',
      false
    )
  }

  if (
    !body ||
    typeof body !== 'object' ||
    !('id' in body) ||
    typeof body.id !== 'string' ||
    !body.id ||
    !('number' in body) ||
    typeof body.number !== 'string' ||
    !body.number ||
    !('status' in body) ||
    !['new', 'confirmed', 'ready', 'completed', 'cancelled'].includes(String(body.status)) ||
    !('totalAmount' in body) ||
    typeof body.totalAmount !== 'number' ||
    !Number.isFinite(body.totalAmount) ||
    body.totalAmount < 0
  ) {
    throw new ReservationRequestError(
      'We received an unexpected response. Please try again to check the same request safely.',
      true
    )
  }
  return {
    id: body.id,
    number: body.number,
    status: body.status as ReservationReceipt['status'],
    totalAmount: body.totalAmount,
  }
}

export class ReservationSubmission {
  private attempt: { input: ReservationInput; key: string } | null = null
  private pending: Promise<ReservationReceipt> | null = null
  private receipt: ReservationReceipt | null = null
  private uncertain = false

  get isSubmitting() {
    return Boolean(this.pending)
  }

  get hasUncertainRequest() {
    return this.uncertain
  }

  submit(input: ReservationInput): Promise<ReservationReceipt> {
    if (this.receipt) {
      return Promise.resolve(this.receipt)
    }
    if (this.pending) {
      return this.pending
    }
    this.attempt ||= { input: structuredClone(input), key: crypto.randomUUID() }
    this.pending = createReservation(this.attempt.input, this.attempt.key)
      .then((receipt) => {
        this.receipt = receipt
        this.attempt = null
        this.uncertain = false
        return receipt
      })
      .catch((error: unknown) => {
        // A later rate-limit or proxy error cannot settle an earlier uncertain write.
        this.uncertain ||= !(error instanceof ReservationRequestError) || error.uncertain
        if (!this.uncertain) {
          this.attempt = null
        }
        throw error
      })
      .finally(() => {
        this.pending = null
      })
    return this.pending
  }
}
