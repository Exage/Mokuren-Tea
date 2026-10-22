import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Types } from 'mongoose'
import type { HydratedDocument } from 'mongoose'
import { PRODUCT_STATUSES, ProductStatus } from '../domain/product-status.js'
import { ProductVariant, ProductVariantSchema } from './product-variant.schema.js'

export type ProductDocument = HydratedDocument<Product>

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true, default: 0 })
  referenceRevision!: number
  @Prop({ required: true, trim: true, maxlength: 300 })
  name!: string

  @Prop({ required: true, trim: true, lowercase: true, maxlength: 300 })
  slug!: string

  @Prop({ required: false, default: '' })
  description!: string

  @Prop({ type: Types.ObjectId, required: false, default: null })
  categoryId!: Types.ObjectId | null

  @Prop({ type: [Types.ObjectId], required: true, default: [] })
  tasteNoteIds!: Types.ObjectId[]

  @Prop({ type: [Types.ObjectId], required: true, default: [] })
  imageIds!: Types.ObjectId[]

  @Prop({ type: [ProductVariantSchema], required: true, default: [] })
  variants!: ProductVariant[]

  @Prop({ type: String, required: true, enum: PRODUCT_STATUSES, default: 'draft' })
  status!: ProductStatus

  @Prop({ type: Date, required: false, default: null })
  firstPublishedAt!: Date | null

  @Prop({ type: Date, required: false, default: null })
  lastPublishedAt!: Date | null

  @Prop({ required: true, default: 0, min: 0 })
  lowStockThresholdGrams!: number
}

export const ProductSchema = SchemaFactory.createForClass(Product)

ProductSchema.index({ slug: 1 }, { unique: true })
ProductSchema.index({ status: 1, firstPublishedAt: -1 })
ProductSchema.index({ categoryId: 1, status: 1 })
ProductSchema.index({ tasteNoteIds: 1, status: 1 })
