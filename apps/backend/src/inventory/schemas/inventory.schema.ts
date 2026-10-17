import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Types } from 'mongoose'
import type { HydratedDocument } from 'mongoose'

export type InventoryDocument = HydratedDocument<Inventory>

// Single stock record per product. Receipts, write-offs and reservations
// arrive later in the inventory module; this stage only creates zero stock
// and reads current grams.
@Schema({ timestamps: { createdAt: false, updatedAt: true } })
export class Inventory {
  @Prop({ type: Types.ObjectId, required: true })
  productId!: Types.ObjectId

  @Prop({ required: true, default: 0, min: 0 })
  physicalGrams!: number

  @Prop({ required: true, default: 0, min: 0 })
  reservedGrams!: number
}

export const InventorySchema = SchemaFactory.createForClass(Inventory)

InventorySchema.index({ productId: 1 }, { unique: true })
