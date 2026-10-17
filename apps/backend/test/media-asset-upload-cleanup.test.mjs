import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { test } from 'node:test'
import { Types } from 'mongoose'
import { MediaAssetsService } from '../dist/media-assets/media-assets.service.js'

function jpegBuffer(size = 1024) {
  const buffer = Buffer.alloc(size)
  buffer[0] = 0xff
  buffer[1] = 0xd8
  buffer[2] = 0xff
  return buffer
}

const file = {
  buffer: jpegBuffer(),
  originalname: 'photo.jpg',
  mimetype: 'image/jpeg',
  size: 1024,
}

function createHarness(overrides = {}) {
  const calls = { destroyed: [], markedFailed: 0, audited: 0 }

  const repository = {
    createUploading: async () => undefined,
    completeUpload: async (assetId, uploaded) => ({
      toObject: () => ({
        _id: assetId,
        kind: 'image',
        status: 'ready',
        cloudinaryAssetId: uploaded.assetId,
        publicId: uploaded.publicId,
        version: uploaded.version,
        secureUrl: uploaded.secureUrl,
        originalName: 'photo.jpg',
        name: 'Photo',
        format: 'jpg',
        mimeType: 'image/jpeg',
        sizeBytes: uploaded.bytes,
        width: uploaded.width,
        height: uploaded.height,
        alt: '',
        usageCount: 0,
        createdBy: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    }),
    markUploadFailed: async () => {
      calls.markedFailed += 1
    },
    ...overrides.repository,
  }

  const cloudinary = {
    isConfigured: () => true,
    buildPublicId: (assetId) => `mokuren-tea/test/${assetId}`,
    uploadImage: async (buffer, publicId) => ({
      assetId: `fake-${publicId}`,
      publicId,
      version: 1,
      secureUrl: `https://res.cloudinary.com/fake/image/upload/${publicId}.jpg`,
      format: 'jpg',
      bytes: buffer.length,
      width: 800,
      height: 600,
    }),
    destroyImage: async (publicId) => {
      calls.destroyed.push(publicId)
    },
    ...overrides.cloudinary,
  }

  const audit = {
    record: async () => {
      calls.audited += 1
    },
    ...overrides.audit,
  }

  const service = new MediaAssetsService(repository, cloudinary, audit, {})
  return { service, calls }
}

test('does not destroy the stored upload when response mapping fails', async () => {
  const incomplete = {
    toObject: () => ({
      _id: new Types.ObjectId('64f000000000000000000010'),
      status: 'ready',
      originalName: 'photo.jpg',
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  }
  const { service, calls } = createHarness({
    repository: { completeUpload: async () => incomplete },
  })

  await assert.rejects(
    service.uploadImageFile(file, 'alt text'),
    (error) => error?.getStatus?.() === 500
  )

  assert.equal(calls.destroyed.length, 0)
  assert.equal(calls.markedFailed, 0)
  assert.equal(calls.audited, 1)
})

test('destroys the upload when metadata persistence fails', async () => {
  const { service, calls } = createHarness({
    repository: {
      completeUpload: async () => {
        throw new Error('database write failed')
      },
    },
  })

  await assert.rejects(service.uploadImageFile(file, 'alt text'))

  assert.equal(calls.destroyed.length, 1)
  assert.equal(calls.markedFailed, 1)
  assert.equal(calls.audited, 0)
})
