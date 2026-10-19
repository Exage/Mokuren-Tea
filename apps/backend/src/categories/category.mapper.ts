import type { CategoryDocument } from './schemas/category.schema.js'
import type { AdminCategoryView, LoadedCategory, PublicCategoryView } from './categories.types.js'

type CategoryInput = CategoryDocument | LoadedCategory | Record<string, unknown>

function toIdString(value: unknown): string {
  return String(value)
}

function toPlain(doc: CategoryInput): Record<string, unknown> {
  const maybeDocument = doc as unknown as { toObject?: () => Record<string, unknown> }

  return typeof maybeDocument.toObject === 'function'
    ? maybeDocument.toObject()
    : (doc as Record<string, unknown>)
}

function toIsoDate(value: Date): string {
  return value.toISOString()
}

// Synchronous explicit response projections. Internal fields
// (`referenceRevision`, `__v`, raw database records) never leak through these
// views. Dates serialize as ISO strings; IDs serialize as strings.
export function toPublicCategory(doc: CategoryInput): PublicCategoryView {
  const plain = toPlain(doc)

  return {
    id: toIdString(plain._id),
    name: plain.name as string,
    slug: plain.slug as string,
    sortOrder: plain.sortOrder as number,
  }
}

export function toAdminCategory(
  doc: CategoryInput,
  productsCount: number
): AdminCategoryView {
  const plain = toPlain(doc)

  return {
    id: toIdString(plain._id),
    name: plain.name as string,
    slug: plain.slug as string,
    sortOrder: plain.sortOrder as number,
    createdAt: toIsoDate(plain.createdAt as Date),
    updatedAt: toIsoDate(plain.updatedAt as Date),
    productsCount: Number(productsCount),
  }
}
