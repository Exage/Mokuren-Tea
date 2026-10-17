import { InternalServerErrorException } from '@nestjs/common'
import { z } from 'zod'
import type { MediaAssetDocument } from './schemas/media-asset.schema.js'

// Accepts the stored identifier (a Mongoose ObjectId or its string form) and
// narrows it to the string id used in API responses.
const mediaAssetId = z
  .unknown()
  .refine((value) => Boolean(value), {
    message: 'Media asset id is required',
  })
  .transform((value) => String(value))

// Explicit allowlist that converts a stored document into the media API view.
// Unknown keys (publicId, cloudinaryAssetId, createdBy, deletedAt, __v) are
// stripped, optional metadata falls back to safe defaults, and required
// metadata errors surface as a server error instead of a partial response.
export const mediaAssetViewSchema = z
  .object({
    _id: mediaAssetId,
    kind: z.string().default('image'),
    status: z.string(),
    secureUrl: z.string().nullable().default(null),
    originalName: z.string(),
    name: z.string(),
    format: z.string().nullable().default(null),
    mimeType: z.string().nullable().default(null),
    sizeBytes: z.number().nullable().default(null),
    width: z.number().nullable().default(null),
    height: z.number().nullable().default(null),
    alt: z.string().default(''),
    usageCount: z.number().default(0),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .transform((doc) => ({
    id: doc._id,
    kind: doc.kind,
    status: doc.status,
    url: doc.secureUrl,
    originalName: doc.originalName,
    name: doc.name,
    format: doc.format,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    width: doc.width,
    height: doc.height,
    alt: doc.alt,
    usageCount: doc.usageCount,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }))

export type MediaAssetView = z.output<typeof mediaAssetViewSchema>

export function toMediaAssetView(doc: MediaAssetDocument): MediaAssetView {
  const result = mediaAssetViewSchema.safeParse(doc.toObject())

  if (!result.success) {
    throw new InternalServerErrorException({
      code: 'INTERNAL_ERROR',
      message: 'Media asset data is invalid',
    })
  }

  return result.data
}
