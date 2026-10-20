import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

export type TasteNoteDocument = HydratedDocument<TasteNote>

const TASTE_NOTE_NAME_MAX_LENGTH = 300
const TASTE_NOTE_SLUG_MAX_LENGTH = 300

@Schema({ timestamps: true })
export class TasteNote {
  @Prop({ required: true, trim: true, maxlength: TASTE_NOTE_NAME_MAX_LENGTH })
  name!: string

  @Prop({
    required: true,
    trim: true,
    lowercase: true,
    maxlength: TASTE_NOTE_SLUG_MAX_LENGTH,
  })
  slug!: string

  @Prop({ required: true, default: 0, min: 0 })
  sortOrder!: number

  @Prop({ required: true, default: 0 })
  referenceRevision!: number
}

export const TasteNoteSchema = SchemaFactory.createForClass(TasteNote)

TasteNoteSchema.index({ slug: 1 }, { unique: true })
TasteNoteSchema.index({ sortOrder: 1, _id: 1 })
