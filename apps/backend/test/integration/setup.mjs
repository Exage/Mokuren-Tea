import 'reflect-metadata'
import { ConfigService } from '@nestjs/config'
import { getConnectionToken } from '@nestjs/mongoose'
import { Test } from '@nestjs/testing'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { createHash, randomBytes } from 'node:crypto'
import { Types } from 'mongoose'
import { AppModule } from '../../dist/app.module.js'
import { corsOptions } from '../../dist/config/cors.js'
import { requestValidationPipe } from '../../dist/config/request-validation.js'

export function hashToken(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export async function startTestApp(databaseName, overrides = {}) {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  })
  const mongoUri = replSet.getUri(databaseName)

  // The application .env file would otherwise override the test database
  // URI, so the config service is replaced for the test application.
  const configStub = {
    getOrThrow: (key) => {
      if (key === 'MONGODB_URI') {
        return mongoUri
      }

      if (key === 'PORT') {
        return 3001
      }

      throw new Error(`Unexpected config key ${key}`)
    },
    get: (key) => {
      if (Object.hasOwn(overrides.config || {}, key)) {
        return overrides.config[key]
      }
      if (key === 'NODE_ENV') {
        return 'test'
      }

      if (key === 'MONGODB_URI') {
        return mongoUri
      }

      // Rate limits are deliberately generous in tests so the suite does not
      // trip them across many sequential requests from localhost.
      if (key === 'RATE_LIMIT_MAX') {
        return '10000'
      }

      if (key === 'RATE_LIMIT_WINDOW_MS') {
        return '60000'
      }

      return undefined
    },
  }

  const testingModule = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConfigService)
    .useValue(configStub)

  if (overrides.cloudinary) {
    const { CloudinaryService } = await import('../../dist/media-assets/cloudinary.service.js')
    testingModule.overrideProvider(CloudinaryService).useValue(overrides.cloudinary)
  }

  const moduleRef = await testingModule.compile()
  const app = moduleRef.createNestApplication({ logger: false })
  app.enableCors(corsOptions(configStub))
  app.setGlobalPrefix('api')
  app.useGlobalPipes(requestValidationPipe())
  await app.init()

  const connection = app.get(getConnectionToken())
  // Mongoose can finish building indexes after app.init(). Wait here so
  // concurrency tests never run before unique constraints become active.
  await Promise.all(connection.modelNames().map((name) => connection.model(name).init()))

  return { app, replSet, connection, db: connection.db }
}

export async function stopTestApp(app, replSet) {
  await app.close()
  await replSet.stop()
}

export async function seedReferences(db) {
  const categoryId = new Types.ObjectId()
  const tasteFloral = new Types.ObjectId()
  const tasteCreamy = new Types.ObjectId()
  const imageId = new Types.ObjectId()

  await db.collection('categories').insertOne({
    _id: categoryId,
    name: 'Oolong',
    slug: 'oolong',
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  await db.collection('tastenotes').insertMany([
    { _id: tasteFloral, name: 'Floral', slug: 'floral' },
    { _id: tasteCreamy, name: 'Creamy', slug: 'creamy' },
  ])
  await db.collection('mediaassets').insertOne({
    _id: imageId,
    kind: 'image',
    status: 'ready',
    cloudinaryAssetId: 'fixture-asset-id',
    publicId: `mokuren-tea/test/${String(imageId)}`,
    version: 1,
    secureUrl: 'https://res.cloudinary.com/demo/image/upload/oolong.jpg',
    originalName: 'oolong.jpg',
    name: 'oolong.jpg',
    format: 'jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 41200,
    width: 800,
    height: 600,
    alt: 'Oolong tea',
    usageCount: 0,
    createdBy: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  return {
    categoryId: String(categoryId),
    tasteFloral: String(tasteFloral),
    tasteCreamy: String(tasteCreamy),
    imageId: String(imageId),
  }
}

export async function createAdmin(db, options = {}) {
  const adminId = new Types.ObjectId()
  const email = `admin-${String(adminId)}@example.com`
  const normalizedEmail = email.toLowerCase()
  const token = randomBytes(32).toString('hex')

  await db.collection('adminusers').insertOne({
    _id: adminId,
    email,
    normalizedEmail,
    displayName: `Administrator ${String(adminId).slice(0, 6)}`,
    passwordHash: 'stub-hash',
    isActive: options.isActive ?? true,
    mustChangePassword: options.mustChangePassword || false,
  })
  await db.collection('adminsessions').insertOne({
    tokenHash: hashToken(token),
    adminUserId: adminId,
    expiresAt: options.expiresAt || new Date(Date.now() + 7 * 24 * 3600 * 1000),
    revokedAt: options.revokedAt || null,
  })

  return { adminId: String(adminId), token }
}

export function authHeaders(token) {
  return { Authorization: `Bearer ${token}` }
}
