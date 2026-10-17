import assert from 'node:assert/strict'
import { test } from 'node:test'
import { InternalServerErrorException } from '@nestjs/common'
import { Types } from 'mongoose'
import { toMediaAssetView } from '../dist/media-assets/media-asset.mapper.js'

function storedDocument(overrides = {}) {
  return {
    _id: new Types.ObjectId('64f000000000000000000001'),
    kind: 'image',
    status: 'ready',
    cloudinaryAssetId: 'cloudinary-id',
    publicId: 'mokuren-tea/test/secret',
    version: 1,
    secureUrl: 'https://res.cloudinary.com/demo/image/upload/tea.jpg',
    originalName: 'tea.jpg',
    name: 'Milk oolong',
    format: 'jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 41200,
    width: 1200,
    height: 800,
    alt: 'Milk oolong leaves',
    usageCount: 2,
    createdBy: 'admin-id',
    deletedAt: null,
    createdAt: new Date('2026-01-05T00:00:00.000Z'),
    updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    __v: 3,
    ...overrides,
  }
}

function asDocument(raw) {
  return { toObject: () => raw }
}

test('renames and converts stored fields into the API view', () => {
  const view = toMediaAssetView(asDocument(storedDocument()))

  assert.deepEqual(view, {
    id: '64f000000000000000000001',
    kind: 'image',
    status: 'ready',
    url: 'https://res.cloudinary.com/demo/image/upload/tea.jpg',
    originalName: 'tea.jpg',
    name: 'Milk oolong',
    format: 'jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 41200,
    width: 1200,
    height: 800,
    alt: 'Milk oolong leaves',
    usageCount: 2,
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  })
})

test('strips internal fields from the API view', () => {
  const view = toMediaAssetView(asDocument(storedDocument()))

  const internal = [
    '_id',
    'secureUrl',
    'cloudinaryAssetId',
    'publicId',
    'version',
    'createdBy',
    'deletedAt',
    '__v',
  ]

  for (const field of internal) {
    assert.ok(!(field in view), `expected ${field} to be excluded`)
  }

  assert.ok(!JSON.stringify(view).includes('mokuren-tea/test/secret'))
})

test('applies defaults for missing optional fields', () => {
  const view = toMediaAssetView(
    asDocument({
      _id: new Types.ObjectId('64f000000000000000000002'),
      status: 'uploading',
      originalName: 'photo.jpg',
      name: 'Photo',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-02T00:00:00.000Z'),
    })
  )

  assert.equal(view.kind, 'image')
  assert.equal(view.url, null)
  assert.equal(view.format, null)
  assert.equal(view.mimeType, null)
  assert.equal(view.sizeBytes, null)
  assert.equal(view.width, null)
  assert.equal(view.height, null)
  assert.equal(view.alt, '')
  assert.equal(view.usageCount, 0)
})

test('does not fall back to "undefined" or the epoch date', () => {
  const view = toMediaAssetView(asDocument(storedDocument()))

  assert.notEqual(view.name, 'undefined')
  assert.notEqual(view.id, 'undefined')
  assert.notEqual(view.createdAt, '1970-01-01T00:00:00.000Z')
  assert.notEqual(view.updatedAt, '1970-01-01T00:00:00.000Z')
})

test('rejects records missing required fields with a server error', () => {
  for (const missing of ['_id', 'status', 'name', 'createdAt', 'updatedAt']) {
    const raw = storedDocument()
    delete raw[missing]

    assert.throws(
      () => toMediaAssetView(asDocument(raw)),
      InternalServerErrorException,
      `expected a server error when ${missing} is missing`
    )
  }
})
