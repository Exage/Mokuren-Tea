export interface IdempotencyResult {
  resultId: string | null
  resultPayload: Record<string, unknown> | null
}

export interface IdempotencyOptions {
  key: string
  operation: string
  contentHash: string
  ttlSeconds?: number
}
