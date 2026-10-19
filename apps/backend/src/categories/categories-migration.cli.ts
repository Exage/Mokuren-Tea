import { Mongoose } from 'mongoose'
import { readFileSync } from 'node:fs'

// Load .env manually so the CLI works without bootstrapping AppModule (which
// would register models and trigger autoIndex / autoCreate on connect).
function loadEnv(): void {
  try {
    const envPath = new URL('../../.env', import.meta.url)
    const content = readFileSync(envPath, 'utf8')

    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim()

      if (!line || line.startsWith('#')) {
        continue
      }

      const eq = line.indexOf('=')
      if (eq === -1) {
        continue
      }

      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      if (key && process.env[key] === undefined) {
        process.env[key] = value
      }
    }
  } catch {
    // .env absent; rely on the process environment.
  }
}

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
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    Number.isSafeInteger(value)
  )
}

// Read-only pre-migration report. It never mutates data and never resolves
// collisions automatically; conflicts are reported for manual resolution.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runReport(db: any): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const categories: any[] = await db.collection('categories').find({}).toArray()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const products: any[] = await db.collection('products').find({}).toArray()
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runBackfill(db: any): Promise<void> {
  const backfillAt = new Date()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const categories: any[] = await db.collection('categories').find({}).toArray()

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
      await db.collection('categories').updateOne({ _id: id }, { $set: updates })
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

async function run(): Promise<void> {
  loadEnv()

  const uri = process.env.MONGODB_URI

  if (typeof uri !== 'string' || uri.length === 0) {
    console.error('MONGODB_URI is required')
    process.exitCode = 1
    return
  }

  // Standalone Mongoose instance: no application models are registered, so no
  // indexes or collections are created by connecting. autoIndex and autoCreate
  // stay disabled regardless of NODE_ENV.
  const mongoose = new Mongoose()

  try {
    await mongoose.connect(uri, {
      autoIndex: false,
      autoCreate: false,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    })

    const db = mongoose.connection.db

    if (!db) {
      console.error('Database is not available')
      process.exitCode = 1
      return
    }

    const mode = process.argv[2] ?? 'report'

    if (mode === 'report') {
      await runReport(db)
    } else if (mode === 'backfill') {
      await runBackfill(db)
    } else {
      console.error(`Unknown mode "${mode}", expected report or backfill`)
      process.exitCode = 1
    }
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

run().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
