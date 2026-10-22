import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Schema as MongooseSchema, Types } from 'mongoose'

// Embedded pack size stored inside the product document. Variants are never
// physically deleted through the API; disabling is used instead.
@Schema({ _id: false })
export class ProductVariant {
  @Prop({ required: true })
  variantId!: string

  @Prop({ required: true, min: 1 })
  weightGrams!: number

  @Prop({ type: MongooseSchema.Types.Decimal128, required: true })
  price!: Types.Decimal128

  @Prop({ required: true, default: true })
  enabled!: boolean
}

export const ProductVariantSchema = SchemaFactory.createForClass(ProductVariant)
