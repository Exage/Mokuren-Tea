import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Types } from 'mongoose'
import type { HydratedDocument } from 'mongoose'

export type ReservationEventDocument = HydratedDocument<ReservationEvent>

// Reservation events record creation, edits and status transitions. They are
// append-only and never edited or deleted. Personal data is kept minimal:
// actor and timestamps only; no customer name/phone duplication.
@Schema({
  collection: 'reservationevents',
  timestamps: { createdAt: true, updatedAt: false },
})
export class ReservationEvent {
  createdAt!: Date

  @Prop({ type: Types.ObjectId, required: true, index: true })
  reservationId!: Types.ObjectId

  @Prop({ type: String, required: true, index: true })
  action!: 'created' | 'edited' | 'status-changed'

  @Prop({ type: String, required: false, default: null })
  oldStatus?: string | null

  @Prop({ type: String, required: false, default: null })
  newStatus?: string | null

  @Prop({ type: Object, required: false, default: null })
  changes?: Record<string, unknown> | null

  @Prop({ type: String, required: false, default: null })
  actorId!: string | null
}

export const ReservationEventSchema = SchemaFactory.createForClass(ReservationEvent)

// History by reservation and time; administrative list by time.
ReservationEventSchema.index({ reservationId: 1, createdAt: -1 })
ReservationEventSchema.index({ createdAt: -1 })
