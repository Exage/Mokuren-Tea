import { Mongoose } from 'mongoose'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
import { TasteNotesMigrationService } from './taste-notes-migration.service.js'

async function run(): Promise<void> {
  const mode = process.argv[2] || 'report'
  if (mode !== 'report' && mode !== 'backfill') {
    throw new Error('Expected report or backfill')
  }

  try {
    loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }

  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI is required')
  }

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
      throw new Error('Database is not available')
    }

    const migration = new TasteNotesMigrationService(db)
    console.log(JSON.stringify(await migration[mode](), null, 2))
  } finally {
    await mongoose.disconnect()
  }
}

run().catch(() => {
  // Connection errors can contain credentials. Keep command output safe.
  console.error('Taste-note migration failed. Check the mode, database configuration and access.')
  process.exitCode = 1
})
