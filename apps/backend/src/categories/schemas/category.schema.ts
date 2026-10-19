import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

export type CategoryDocument = HydratedDocument<Category>

// Slug uniqueness is protected by a unique database index. Display names are
// intentionally NOT unique and there is no `normalizedName` field.
@Schema({ timestamps: true, collection: 'categories' })
export class Category {
  @Prop({ required: true, trim: true, maxlength: 300 })
  name!: string

  @Prop({ required: true, maxlength: 300 })
  slug!: string

  @Prop({ required: true, default: 0, min: 0 })
  sortOrder!: number

  @Prop({ required: true, default: 0 })
  referenceRevision!: number
}

export const CategorySchema = SchemaFactory.createForClass(Category)

CategorySchema.index({ slug: 1 }, { unique: true })
CategorySchema.index({ sortOrder: 1, _id: 1 })
