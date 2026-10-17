import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

export type MediaAssetDocument = HydratedDocument<MediaAsset>

export const MEDIA_ASSET_KINDS = ['image'] as const
export type MediaAssetKind = (typeof MEDIA_ASSET_KINDS)[number]

export const MEDIA_ASSET_STATUSES = ['uploading', 'ready', 'failed', 'deleting', 'deleted'] as const
export type MediaAssetStatus = (typeof MEDIA_ASSET_STATUSES)[number]

// Internal media library record. Cloudinary holds the binary, MongoDB holds
// the metadata. The client can never set status, usageCount or Cloudinary
// identifiers; those are managed exclusively by MediaAssetsService.
@Schema({ collection: 'mediaassets', timestamps: true })
export class MediaAsset {
  @Prop({ type: String, required: true, enum: MEDIA_ASSET_KINDS, default: 'image' })
  kind!: MediaAssetKind

  @Prop({ type: String, required: true, enum: MEDIA_ASSET_STATUSES, default: 'uploading' })
  status!: MediaAssetStatus

  @Prop({ type: String, required: false, default: null })
  cloudinaryAssetId!: string | null

  // Pre-chosen unique Cloudinary public_id, known before the upload starts so
  // a partially completed upload can be reconciled or cleaned up later.
  @Prop({ type: String, required: true })
  publicId!: string

  @Prop({ type: Number, required: false, default: null })
  version!: number | null

  @Prop({ type: String, required: false, default: null })
  secureUrl!: string | null

  @Prop({ required: true, trim: true, maxlength: 255 })
  originalName!: string

  @Prop({ type: String, required: true, trim: true, maxlength: 255 })
  name!: string

  @Prop({ type: String, required: false, default: null })
  format!: string | null

  @Prop({ type: String, required: false, default: null })
  mimeType!: string | null

  @Prop({ type: Number, required: false, default: null, min: 0 })
  sizeBytes!: number | null

  @Prop({ type: Number, required: false, default: null, min: 0 })
  width!: number | null

  @Prop({ type: Number, required: false, default: null, min: 0 })
  height!: number | null

  @Prop({ type: String, required: false, default: '', maxlength: 500 })
  alt!: string

  // Denormalized count of products referencing this asset. Maintained
  // transactionally together with Product.imageIds; the delete path also
  // rechecks the products collection so a stale counter cannot cause data loss.
  @Prop({ required: true, default: 0, min: 0 })
  usageCount!: number

  @Prop({ type: String, required: false, default: null })
  createdBy!: string | null

  @Prop({ type: Date, required: false, default: null })
  deletedAt!: Date | null
}

export const MediaAssetSchema = SchemaFactory.createForClass(MediaAsset)

// Unique publicId prevents accidental overwrites in Cloudinary. Status
// indexes serve the default ready listing and the reconcile sweeps; the name
// index supports the library search. In production autoIndex is disabled, so
// these indexes must be created explicitly (see README).
MediaAssetSchema.index({ publicId: 1 }, { unique: true })
MediaAssetSchema.index({ status: 1, createdAt: -1 })
MediaAssetSchema.index({ status: 1, updatedAt: 1 })
MediaAssetSchema.index({ originalName: 1 })
MediaAssetSchema.index({ cloudinaryAssetId: 1 }, { sparse: true })
