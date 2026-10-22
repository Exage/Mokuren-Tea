import type { mongo } from 'mongoose'

const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function normalizeSlug(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const slug = value.trim().toLowerCase()

  return slug.length === 0 ? null : slug
}

function isValidSortOrder(value: unknown): boolean {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    Number.isSafeInteger(value)
  )
}

function isValidReferenceRevision(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && Number.isSafeInteger(value)
}

export class CategoriesMigrationService {
  constructor(private readonly db: mongo.Db) {}

  // Read-only pre-migration report. It never mutates data and never resolves
  // collisions automatically; conflicts are reported for manual resolution.
  async report(): Promise<void> {
    const categories = await this.db.collection('categories').find({}).toArray()
    const products = await this.db.collection('products').find({}).toArray()
    const categoryIds = new Set(categories.map((category) => String(category._id)))

    const changedSlugs: string[] = []
    const invalidOrMissing: string[] = []
    const missingTechnical: string[] = []
    const normalizedToIds = new Map<string, string[]>()

    for (const category of categories) {
      const id = String(category._id)
      const name = category.name
      const slug = category.slug
      const normalized = normalizeSlug(slug)

      if (
        typeof name !== 'string' ||
        name.trim().length === 0 ||
        typeof slug !== 'string' ||
        slug.trim().length === 0
      ) {
        invalidOrMissing.push(id)
        continue
      }

      if (!normalized || !CATEGORY_SLUG_PATTERN.test(normalized)) {
        invalidOrMissing.push(id)
        continue
      }

      if (slug !== normalized) {
        changedSlugs.push(id)
      }

      const bucket = normalizedToIds.get(normalized) || []
      bucket.push(id)
      normalizedToIds.set(normalized, bucket)

      if (!isValidSortOrder(category.sortOrder)) {
        missingTechnical.push(id)
      }

      if (!isValidReferenceRevision(category.referenceRevision)) {
        missingTechnical.push(id)
      }

      if (!category.createdAt || !category.updatedAt) {
        missingTechnical.push(id)
      }
    }

    const collisions = [...normalizedToIds.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([slug, ids]) => ({ slug, ids }))

    const dangling: string[] = []
    const publishedNoCategory: string[] = []

    for (const product of products) {
      const categoryId = product.categoryId

      if (categoryId) {
        if (!categoryIds.has(String(categoryId))) {
          dangling.push(String(product._id))
        }
      } else if (product.status === 'published') {
        publishedNoCategory.push(String(product._id))
      }
    }

    console.log(`Categories scanned: ${categories.length}`)
    console.log(`Slugs changed by trim/lowercase normalization: ${changedSlugs.length}`)
    if (changedSlugs.length > 0) {
      console.log(JSON.stringify(changedSlugs))
    }

    console.log(`Normalization collisions (including exact duplicates): ${collisions.length}`)
    if (collisions.length > 0) {
      console.log(JSON.stringify(collisions))
    }

    console.log(`Invalid or missing name/slug values: ${invalidOrMissing.length}`)
    console.log(
      `Missing/invalid sortOrder, referenceRevision, or timestamps: ${missingTechnical.length}`
    )
    console.log(`Products referencing missing categories: ${dangling.length}`)
    console.log(`Published products with no category: ${publishedNoCategory.length}`)
    console.log('This is a read-only report; no data was modified.')
  }

  // Repeatable backfill: fills missing technical defaults without resetting
  // existing values. Backfill timestamps are migration-time values, not known
  // original creation dates. Safe to repeat: valid fields are never rewritten.
  async backfill(): Promise<void> {
    const backfillAt = new Date()
    const categories = await this.db.collection('categories').find({}).toArray()

    let backfilled = 0
    let skipped = 0

    for (const category of categories) {
      const id = category._id
      const updates: Record<string, unknown> = {}

      if (!category.createdAt) {
        updates.createdAt = backfillAt
      }

      if (!category.updatedAt) {
        updates.updatedAt = backfillAt
      }

      if (!isValidSortOrder(category.sortOrder)) {
        updates.sortOrder = 0
      }

      if (!isValidReferenceRevision(category.referenceRevision)) {
        updates.referenceRevision = 0
      }

      if (Object.keys(updates).length > 0) {
        await this.db.collection('categories').updateOne({ _id: id }, { $set: updates })
        backfilled++
      } else {
        skipped++
      }
    }

    console.log(
      `Backfill complete: ${backfilled} category(ies) updated, ${skipped} already had valid technical fields.`
    )
    console.log(
      `Backfill timestamps are migration-time values (${backfillAt.toISOString()}), not known original creation dates.`
    )
  }
}
