import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Types } from 'mongoose'

// Stock is shared by all pack sizes of one product.
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
