import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

export type StoreSettingsDocument = HydratedDocument<StoreSettings>

// Singleton document holding general store settings. There must be exactly one
// document in this collection; creation is guarded by a unique index on a
// constant field so concurrent creation attempts cannot produce duplicates.
@Schema({
  collection: 'storesettings',
  optimisticConcurrency: true,
  timestamps: { createdAt: false, updatedAt: true },
})
export class StoreSettings {
  createdAt!: Date
  updatedAt!: Date

  @Prop({ type: String, required: true, default: 'settings' })
  _id!: string

  @Prop({ type: String, required: true, trim: true, maxlength: 200 })
  name!: string

  @Prop({ type: String, required: false, default: null, trim: true, maxlength: 500 })
  tagline!: string | null

  @Prop({ type: String, required: false, default: null, trim: true, maxlength: 500 })
  address!: string | null

  @Prop({ type: String, required: false, default: null, trim: true, maxlength: 500 })
  hours!: string | null

  @Prop({ type: String, required: false, default: null, trim: true, maxlength: 100 })
  phone!: string | null

  @Prop({ type: Object, required: false, default: null })
  contacts!: Record<string, unknown> | null
}

export const StoreSettingsSchema = SchemaFactory.createForClass(StoreSettings)

// MongoDB's built-in _id index guarantees singleton creation.
