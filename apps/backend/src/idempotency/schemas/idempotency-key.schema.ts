import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

export type IdempotencyKeyDocument = HydratedDocument<IdempotencyKey>

// Idempotency keys tie a client-supplied Idempotency-Key to a specific
// operation and to the normalized request content. Replaying the same key
// with the same content returns the stored result; replaying with different
// content is a conflict. Keys expire after a TTL and are cleaned lazily.
@Schema({
  collection: 'idempotencykeys',
  timestamps: { createdAt: true, updatedAt: false },
})
export class IdempotencyKey {
  @Prop({ type: String, required: true, unique: true, index: true })
  key!: string

  // Hashed normalized request body, so equal requests produce the same hash
  // and different requests with the same key are rejected.
  @Prop({ type: String, required: true, index: true })
  contentHash!: string

  // Operation family (e.g. 'reservation.create', 'inventory.receipt') so the
  // same key cannot be reused across unrelated operations.
  @Prop({ type: String, required: true, index: true })
  operation!: string

  // Stored result id (e.g. reservation id or movement id) returned on replay.
  @Prop({ type: String, required: false, default: null })
  resultId!: string | null

  // Serialized stored result, returned verbatim on replay so the client sees
  // exactly what the original request produced.
  @Prop({ type: Object, required: false, default: null })
  resultPayload!: Record<string, unknown> | null

  // The request is considered in flight until a result is stored. A second
  // concurrent request that finds an in-flight key waits/fails rather than
  // creating a duplicate operation.
  @Prop({ type: Boolean, required: true, default: false, index: true })
  inFlight!: boolean

  @Prop({ type: Date, required: true })
  expiresAt!: Date
}

export const IdempotencyKeySchema = SchemaFactory.createForClass(IdempotencyKey)

// TTL index: keys are removed automatically after expiresAt.
IdempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
