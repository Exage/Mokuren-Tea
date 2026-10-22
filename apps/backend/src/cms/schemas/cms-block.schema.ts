import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'
import { CMS_BLOCK_KEYS, CmsBlockKey } from '../cms.types.js'

export type CmsBlockDocument = HydratedDocument<CmsBlock>

// One document per CMS block (unique pageKey + blockKey). Holds both the draft
// being edited and the last published content. Drafts are never served
// publicly.
@Schema({
  collection: 'cmsblocks',
  timestamps: { createdAt: true, updatedAt: true },
})
export class CmsBlock {
  createdAt!: Date
  updatedAt!: Date

  @Prop({ type: String, required: true, trim: true, maxlength: 100 })
  pageKey!: string

  @Prop({
    type: String,
    required: true,
    enum: CMS_BLOCK_KEYS,
    index: true,
  })
  blockKey!: CmsBlockKey

  // Draft content being edited. Not visible to the public.
  @Prop({ type: Object, required: false, default: null })
  draft!: Record<string, unknown> | null

  @Prop({ required: true, default: 0, min: 0 })
  draftVersion!: number

  // Last published content. Served to the public.
  @Prop({ type: Object, required: false, default: null })
  published!: Record<string, unknown> | null

  @Prop({ required: true, default: 0, min: 0 })
  publishedVersion!: number

  @Prop({ type: String, required: false, default: null })
  updatedBy!: string | null
}

export const CmsBlockSchema = SchemaFactory.createForClass(CmsBlock)

CmsBlockSchema.index({ pageKey: 1, blockKey: 1 }, { unique: true })
