import { z } from 'zod'
import type { CmsBlockKey } from './cms.types.js'

// ---------------------------------------------------------------------------
// Content schemas per fixed CMS block.
//
// These define the exact shape of content that may be saved as a draft or
// published for each block. Unknown fields are stripped. No arbitrary HTML is
// permitted: all text fields are plain strings.
//
// Field names cover the fixed editorial sections in the exported storefront
// at the workspace root. Image URLs are never stored here; only media IDs.
// ---------------------------------------------------------------------------

const nonEmptyString = z.string().trim().min(1)
const safeLink = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) => /^\/(?!\/)/.test(value) || /^https:\/\//i.test(value),
    'must be an internal path or HTTPS URL'
  )

const objectIdString = z
  .string()
  .trim()
  .refine((value) => /^[0-9a-fA-F]{24}$/.test(value), 'must be a 24-character hex ObjectId string')

// home.hero
export const heroContentSchema = z
  .object({
    eyebrow: nonEmptyString.max(100).optional(),
    title: nonEmptyString.max(200),
    subtitle: nonEmptyString.max(500).optional(),
    imageId: objectIdString.optional(),
    buttonText: z.string().max(100).optional(),
    buttonUrl: safeLink.optional(),
    secondaryButtonText: z.string().max(100).optional(),
    secondaryButtonUrl: safeLink.optional(),
  })
  .strict()

// home.testimonials
const testimonialSchema = z.object({
  name: nonEmptyString.max(200),
  text: nonEmptyString.max(1000),
  rating: z.number().int().min(1).max(5).optional(),
})

export const testimonialsContentSchema = z
  .object({
    eyebrow: nonEmptyString.max(100).optional(),
    title: nonEmptyString.max(200).optional(),
    testimonials: z.array(testimonialSchema).min(0).max(20),
  })
  .strict()

// home.featuredTeas
export const featuredTeasContentSchema = z
  .object({
    eyebrow: nonEmptyString.max(100).optional(),
    title: nonEmptyString.max(200).optional(),
    subtitle: nonEmptyString.max(500).optional(),
    teaIds: z.array(objectIdString).min(1).max(4),
  })
  .strict()

// home.visitStore
export const visitStoreContentSchema = z
  .object({
    eyebrow: nonEmptyString.max(100).optional(),
    title: nonEmptyString.max(200),
    subtitle: nonEmptyString.max(500).optional(),
    imageId: objectIdString.optional(),
    address: nonEmptyString.max(500),
    hours: nonEmptyString.max(500),
  })
  .strict()

// catalog.header
export const catalogHeaderContentSchema = z
  .object({
    title: nonEmptyString.max(200),
    subtitle: nonEmptyString.max(500).optional(),
    imageId: objectIdString.optional(),
  })
  .strict()

// about.content
export const aboutContentSchema = z
  .object({
    title: nonEmptyString.max(200),
    body: nonEmptyString.max(10000),
    imageId: objectIdString.optional(),
  })
  .strict()

// contacts.content
export const contactsContentSchema = z
  .object({
    title: nonEmptyString.max(200),
    address: nonEmptyString.max(500),
    phone: nonEmptyString.max(100),
    email: z.string().email().max(200),
    hours: nonEmptyString.max(500),
  })
  .strict()

export const CMS_CONTENT_SCHEMAS: Record<CmsBlockKey, z.ZodTypeAny> = {
  'home.hero': heroContentSchema,
  'home.testimonials': testimonialsContentSchema,
  'home.featuredTeas': featuredTeasContentSchema,
  'home.visitStore': visitStoreContentSchema,
  'catalog.header': catalogHeaderContentSchema,
  'about.content': aboutContentSchema,
  'contacts.content': contactsContentSchema,
}

export function validateBlockContent(
  blockKey: CmsBlockKey,
  content: unknown
): { success: true; data: Record<string, unknown> } | { success: false; errors: string[] } {
  const schema = CMS_CONTENT_SCHEMAS[blockKey]

  if (!schema) {
    return {
      success: false,
      errors: [`Unknown block key: ${blockKey}`],
    }
  }

  const result = schema.safeParse(content)

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`),
    }
  }

  return { success: true, data: result.data as Record<string, unknown> }
}
