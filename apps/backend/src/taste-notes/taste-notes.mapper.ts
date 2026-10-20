import { ServiceUnavailableException } from '@nestjs/common'
import type { TasteNoteDocument } from './schemas/taste-note.schema.js'
import type { AdminTasteNoteView, LoadedTasteNote, PublicTasteNoteView } from './taste-notes.types.js'

type TasteNoteInput = TasteNoteDocument | LoadedTasteNote | Record<string, unknown>

function toIdString(value: unknown): string {
  return String(value)
}

function toPlain(doc: TasteNoteInput): Record<string, unknown> {
  const maybeDocument = doc as unknown as { toObject?: () => Record<string, unknown> }

  return typeof maybeDocument.toObject === 'function'
    ? maybeDocument.toObject()
    : (doc as Record<string, unknown>)
}

function toIsoDate(value: Date): string {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new ServiceUnavailableException({
      code: 'TASTE_NOTES_MIGRATION_REQUIRED',
      message: 'Taste-note timestamps are missing or invalid; run the taste-note migration before enabling admin access',
    })
  }

  return value.toISOString()
}

// Synchronous explicit response projections. Internal fields
// (`referenceRevision`, `__v`, raw database records) never leak through these
// views. Dates serialize as ISO strings; IDs serialize as strings.
export function toPublicTasteNote(doc: TasteNoteInput): PublicTasteNoteView {
  const plain = toPlain(doc)

  return {
    id: toIdString(plain._id),
    name: plain.name as string,
    slug: plain.slug as string,
    sortOrder: plain.sortOrder as number,
  }
}

export function toAdminTasteNote(
  doc: TasteNoteInput,
  productsCount: number
): AdminTasteNoteView {
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
