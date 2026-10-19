import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { getConnectionToken } from '@nestjs/mongoose'
import { Test } from '@nestjs/testing'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { createHash, randomBytes } from 'node:crypto'
import { Types } from 'mongoose'
import { AppModule } from '../../dist/app.module.js'

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
      if (key === 'NODE_ENV') {
        return 'test'
      }

      if (key === 'MONGODB_URI') {
        return mongoUri
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
  app.setGlobalPrefix('api')
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  )
  await app.init()

  const connection = app.get(getConnectionToken())

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
  const token = randomBytes(32).toString('hex')

  await db.collection('adminusers').insertOne({
    _id: adminId,
    username: `admin-${adminId}`,
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
