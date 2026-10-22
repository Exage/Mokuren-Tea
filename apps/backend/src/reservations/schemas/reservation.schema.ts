import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Schema as MongooseSchema, Types } from 'mongoose'
import type { HydratedDocument } from 'mongoose'
import {
  RESERVATION_SOURCES,
  RESERVATION_STATUSES,
  ReservationStatus,
} from '../reservations.types.js'

export type ReservationDocument = HydratedDocument<Reservation>

// A reservation is a customer's intent to buy tea. It holds snapshots of
// product names, weights and prices at creation time so later product edits
// never alter a saved reservation. Money is stored as Decimal128.
@Schema({
  collection: 'reservations',
  optimisticConcurrency: true,
  timestamps: { createdAt: true, updatedAt: true },
})
export class Reservation {
  createdAt!: Date
  updatedAt!: Date

  @Prop({ type: String, required: true })
  number!: string

  @Prop({
    type: String,
    required: true,
    enum: RESERVATION_SOURCES,
    index: true,
  })
  source!: 'website' | 'admin'

  @Prop({ type: String, required: true, trim: true, maxlength: 200 })
  customerName!: string

  @Prop({ type: String, required: true, trim: true, maxlength: 50 })
  customerPhone!: string

  @Prop({
    type: String,
    required: true,
    enum: RESERVATION_STATUSES,
    default: 'new',
    index: true,
  })
  status!: ReservationStatus

  @Prop({
    type: [
      {
        productId: { type: Types.ObjectId, required: true },
        productName: { type: String, required: true },
        variantId: { type: String, required: true },
        variantWeightGrams: { type: Number, required: true, min: 1 },
        variantPrice: { type: MongooseSchema.Types.Decimal128, required: true },
        quantity: { type: Number, required: true, min: 1 },
        lineTotal: { type: MongooseSchema.Types.Decimal128, required: true },
        grams: { type: Number, required: true, min: 0 },
      },
    ],
    required: true,
    default: [],
  })
  lines!: ReservationLineSnapshot[]

  @Prop({ required: true, default: 0, min: 0 })
  totalGrams!: number

  @Prop({ type: MongooseSchema.Types.Decimal128, required: true })
  totalAmount!: Types.Decimal128

  @Prop({ type: Types.ObjectId, required: false, default: null })
  createdByAdminId!: Types.ObjectId | null
}

export interface ReservationLineSnapshot {
  productId: Types.ObjectId
  productName: string
  variantId: string
  variantWeightGrams: number
  variantPrice: Types.Decimal128
  quantity: number
  lineTotal: Types.Decimal128
  grams: number
}

export const ReservationSchema = SchemaFactory.createForClass(Reservation)

// Unique number index; status indexes for admin list and event history.
ReservationSchema.index({ number: 1 }, { unique: true })
ReservationSchema.index({ status: 1, createdAt: -1 })
ReservationSchema.index({ source: 1, createdAt: -1 })
