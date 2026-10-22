import { BadRequestException, ConflictException, Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { createHash } from 'node:crypto'
import type { ClientSession } from 'mongoose'
import { IdempotencyKey } from './schemas/idempotency-key.schema.js'
import type { IdempotencyKeyDocument } from './schemas/idempotency-key.schema.js'
import type { IdempotencyOptions, IdempotencyResult } from './idempotency.types.js'

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectModel(IdempotencyKey.name)
    private readonly keyModel: Model<IdempotencyKeyDocument>
  ) {}

  private validateKey(key: string): void {
    if (!/^[\x21-\x7e]{8,200}$/.test(key)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Idempotency-Key must contain 8 to 200 visible ASCII characters',
      })
    }
  }

  async lookup(options: IdempotencyOptions): Promise<IdempotencyResult | null> {
    this.validateKey(options.key)
    const existing = await this.keyModel.findOne({ key: options.key }).exec()
    if (!existing) {
      return null
    }
    if (existing.contentHash !== options.contentHash || existing.operation !== options.operation) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'This idempotency key was already used with different content',
      })
    }
    if (existing.inFlight) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_IN_FLIGHT',
        message: 'An identical request is already being processed',
      })
    }
    return { resultId: existing.resultId, resultPayload: existing.resultPayload }
  }

  async claim(options: IdempotencyOptions): Promise<{
    claimed: boolean
    replay: IdempotencyResult | null
  }> {
    const replay = await this.lookup(options)
    if (replay) {
      return { claimed: false, replay }
    }
    const expiresAt = new Date(Date.now() + (options.ttlSeconds ?? 86400) * 1000)

    // No existing entry: mark in flight so a concurrent duplicate is rejected.
    try {
      await this.keyModel.create([
        {
          key: options.key,
          contentHash: options.contentHash,
          operation: options.operation,
          resultId: null,
          resultPayload: null,
          inFlight: true,
          expiresAt,
        },
      ])
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        const replay = await this.lookup(options)
        return { claimed: false, replay }
      }
      throw error
    }

    return { claimed: true, replay: null }
  }

  // Stores the completed result and clears the in-flight flag. Must be called
  // once the operation succeeds. The session is optional; idempotency writes
  // are normally committed with the business transaction but can be
  // independent when the caller prefers.
  async complete(
    key: string,
    resultId: string | null,
    resultPayload: Record<string, unknown> | null,
    session?: ClientSession
  ): Promise<void> {
    const result = await this.keyModel
      .updateOne(
        { key, inFlight: true },
        { $set: { inFlight: false, resultId, resultPayload } },
        { session: session || undefined }
      )
      .exec()
    if (result.modifiedCount !== 1) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'Idempotency claim was lost',
      })
    }
  }

  async abandon(key: string): Promise<void> {
    await this.keyModel.deleteOne({ key, inFlight: true }).exec()
  }

  async computeHash(content: unknown): Promise<string> {
    return createHash('sha256').update(JSON.stringify(content)).digest('hex')
  }
}
