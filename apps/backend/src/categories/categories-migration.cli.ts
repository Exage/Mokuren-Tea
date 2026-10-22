import { Mongoose } from 'mongoose'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
import { CategoriesMigrationService } from './categories-migration.service.js'

async function run(): Promise<void> {
  try {
    loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }

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

    const migration = new CategoriesMigrationService(db)
    const mode = process.argv[2] || 'report'

    if (mode === 'report') {
      await migration.report()
    } else if (mode === 'backfill') {
      await migration.backfill()
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
