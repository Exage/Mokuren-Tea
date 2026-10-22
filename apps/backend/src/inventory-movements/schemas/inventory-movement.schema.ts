import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Types } from 'mongoose'
import type { HydratedDocument } from 'mongoose'
import { INVENTORY_MOVEMENT_TYPES, InventoryMovementType } from '../inventory-movements.types.js'

export type InventoryMovementDocument = HydratedDocument<InventoryMovement>

// One movement record per stock-changing operation. Movements are immutable;
// corrections create a new record referencing the original via correctionOfId.
@Schema({
  collection: 'inventorymovements',
  timestamps: { createdAt: true, updatedAt: false },
})
export class InventoryMovement {
  createdAt!: Date

  @Prop({ type: Types.ObjectId, required: true, index: true })
  productId!: Types.ObjectId

  @Prop({
    type: String,
    required: true,
    enum: INVENTORY_MOVEMENT_TYPES,
    index: true,
  })
  type!: InventoryMovementType

  @Prop({
    type: {
      physicalGrams: { type: Number, required: true, min: 0 },
      reservedGrams: { type: Number, required: true, min: 0 },
    },
    required: true,
  })
  before!: { physicalGrams: number; reservedGrams: number }

  @Prop({
    type: {
      physicalGrams: { type: Number, required: true },
      reservedGrams: { type: Number, required: true },
    },
    required: true,
  })
  delta!: { physicalGrams: number; reservedGrams: number }

  @Prop({
    type: {
      physicalGrams: { type: Number, required: true, min: 0 },
      reservedGrams: { type: Number, required: true, min: 0 },
    },
    required: true,
  })
  after!: { physicalGrams: number; reservedGrams: number }

  @Prop({ type: String, required: false, default: null, maxlength: 1000 })
  reason!: string | null

  @Prop({ type: Types.ObjectId, required: false, default: null })
  reservationId!: Types.ObjectId | null

  @Prop({
    type: Types.ObjectId,
    required: false,
    default: null,
  })
  correctionOfId!: Types.ObjectId | null

  @Prop({ type: String, required: false, default: null })
  actorId!: string | null
}

export const InventoryMovementSchema = SchemaFactory.createForClass(InventoryMovement)

// History by product and time; search by reservation and by correction target.
InventoryMovementSchema.index({ productId: 1, createdAt: -1 })
InventoryMovementSchema.index({ reservationId: 1 })
InventoryMovementSchema.index({ correctionOfId: 1 }, { sparse: true })
