import type { mongo } from 'mongoose'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const TECHNICAL_FIELDS = ['createdAt', 'updatedAt', 'sortOrder', 'referenceRevision'] as const

function isValidTechnicalField(field: string, value: unknown): boolean {
  if (field === 'createdAt' || field === 'updatedAt') {
    return value instanceof Date && Number.isFinite(value.getTime())
  }

  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

// Uses raw collections so reporting does not create indexes or hide missing
// fields behind Mongoose defaults. Run with application writes stopped.
export class TasteNotesMigrationService {
  constructor(private readonly db: mongo.Db) {}

  async report() {
    const notes = await this.db.collection('tastenotes').find({}).toArray()
    const ids = new Set(notes.map((note) => String(note._id)))
    const slugs = new Map<string, string[]>()
    const invalidBusinessFields: string[] = []
    const nonNormalizedSlugs: string[] = []
    const technicalIssues: { id: string; fields: string[] }[] = []

    for (const note of notes) {
      const id = String(note._id)
      const slug = typeof note.slug === 'string' ? note.slug.trim().toLowerCase() : ''

      if (
        typeof note.name !== 'string' || !note.name.trim() || note.name.length > 300 ||
        !SLUG_PATTERN.test(slug) || slug.length > 300
      ) {
        invalidBusinessFields.push(id)
      }

      if (slug) {
        slugs.set(slug, [...(slugs.get(slug) || []), id])
        if (slug !== note.slug) {
          nonNormalizedSlugs.push(id)
        }
      }

      const fields = TECHNICAL_FIELDS.filter((field) => !isValidTechnicalField(field, note[field]))
      if (fields.length > 0) {
        technicalIssues.push({ id, fields })
      }
    }

    const danglingReferences: { productId: string; tasteNoteId: string }[] = []
    for await (const product of this.db.collection('products').find(
      { 'tasteNoteIds.0': { $exists: true } },
      { projection: { tasteNoteIds: 1 } }
    )) {
      for (const id of product.tasteNoteIds) {
        if (!ids.has(String(id))) {
          danglingReferences.push({ productId: String(product._id), tasteNoteId: String(id) })
        }
      }
    }

    return {
      scanned: notes.length,
      invalidBusinessFields,
      nonNormalizedSlugs,
      slugCollisions: [...slugs].filter(([, values]) => values.length > 1)
        .map(([slug, values]) => ({ slug, ids: values })),
      technicalIssues,
      danglingReferences,
    }
  }

  async backfill() {
    const backfillAt = new Date()
    const updatedIds = new Set<string>()
    const notes = this.db.collection('tastenotes')

    for await (const note of notes.find({})) {
      for (const field of TECHNICAL_FIELDS) {
        // Null/missing defaults are safe to fill. Invalid non-null values need
        // investigation; do not silently overwrite possibly meaningful data.
        if (note[field] !== undefined && note[field] !== null) {
          continue
        }

        const result = await notes.updateOne(
          { _id: note._id, [field]: null },
          { $set: { [field]: field.endsWith('At') ? backfillAt : 0 } }
        )
        if (result.modifiedCount > 0) {
          updatedIds.add(String(note._id))
        }
      }
    }

    return { updated: updatedIds.size, backfillAt, remainingIssues: await this.report() }
  }
}
