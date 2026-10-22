import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'
import { CMS_BLOCK_KEYS, CmsBlockKey } from '../cms.types.js'

export type CmsRevisionDocument = HydratedDocument<CmsRevision>

// Append-only history of published CMS block content. Each revision is a
// snapshot of what was published at a given version.
@Schema({
  collection: 'cmsrevisions',
  timestamps: { createdAt: true, updatedAt: false },
})
export class CmsRevision {
  createdAt!: Date

  @Prop({ type: String, required: true, index: true })
  pageKey!: string

  @Prop({
    type: String,
    required: true,
    enum: CMS_BLOCK_KEYS,
    index: true,
  })
  blockKey!: CmsBlockKey

  @Prop({ required: true, min: 1 })
  version!: number

  @Prop({ type: Object, required: true })
  content!: Record<string, unknown>

  @Prop({ type: String, required: false, default: null })
  publishedBy!: string | null
}

export const CmsRevisionSchema = SchemaFactory.createForClass(CmsRevision)

CmsRevisionSchema.index({ pageKey: 1, blockKey: 1, version: 1 }, { unique: true })
CmsRevisionSchema.index({ pageKey: 1, blockKey: 1, createdAt: -1 })
