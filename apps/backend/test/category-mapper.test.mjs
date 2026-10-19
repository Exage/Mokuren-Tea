import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Types } from 'mongoose'
import { toAdminCategory, toPublicCategory } from '../dist/categories/category.mapper.js'

function storedCategory(overrides = {}) {
  return {
    _id: new Types.ObjectId('64f000000000000000000001'),
    name: 'Oolong',
    slug: 'oolong',
    sortOrder: 5,
    referenceRevision: 3,
    createdAt: new Date('2026-01-05T00:00:00.000Z'),
    updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    __v: 0,
    ...overrides,
  }
}

function asDocument(raw) {
  return { toObject: () => raw }
}

test('projects public category fields without internal fields', () => {
  const view = toPublicCategory(asDocument(storedCategory()))

  assert.deepEqual(view, {
    id: '64f000000000000000000001',
    name: 'Oolong',
    slug: 'oolong',
    sortOrder: 5,
  })

  for (const field of ['referenceRevision', '__v', '_id', 'createdAt', 'updatedAt']) {
    assert.ok(!(field in view), `expected ${field} to be excluded`)
  }
})

test('projects admin category fields including timestamps and products count', () => {
  const view = toAdminCategory(asDocument(storedCategory()), 12)

  assert.deepEqual(view, {
    id: '64f000000000000000000001',
    name: 'Oolong',
    slug: 'oolong',
    sortOrder: 5,
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    productsCount: 12,
  })

  assert.ok(!('referenceRevision' in view))
  assert.ok(!('__v' in view))
})
