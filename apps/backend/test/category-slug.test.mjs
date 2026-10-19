import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BadRequestException } from '@nestjs/common'
import {
  normalizeCategoryName,
  normalizeCategorySlug,
  normalizeCategorySortOrder,
} from '../dist/categories/category-normalization.js'

test('trims and lowercases a category slug', () => {
  assert.equal(normalizeCategorySlug('  OOLONG  '), 'oolong')
})

test('keeps a valid slug unchanged', () => {
  assert.equal(normalizeCategorySlug('milk-oolong'), 'milk-oolong')
})

test('rejects a non-string slug', () => {
  for (const value of [null, undefined, 42, [], {}, true]) {
    assert.throws(() => normalizeCategorySlug(value), BadRequestException)
  }
})

test('rejects an empty slug after normalization', () => {
  assert.throws(() => normalizeCategorySlug('   '), BadRequestException)
})

test('rejects a slug over 300 characters', () => {
  assert.throws(() => normalizeCategorySlug('a'.repeat(301)), BadRequestException)
})

test('rejects a malformed slug', () => {
  for (const value of ['Milk Oolong', 'milk_oolong', '.hidden', '-dash', 'dash-', 'a--b', '']) {
    assert.throws(() => normalizeCategorySlug(value), BadRequestException)
  }
})

test('trims and preserves case and language of a category name', () => {
  assert.equal(normalizeCategoryName('  Молочный улун  '), 'Молочный улун')
})

test('rejects a non-string name', () => {
  assert.throws(() => normalizeCategoryName(null), BadRequestException)
})

test('rejects an empty name after normalization', () => {
  assert.throws(() => normalizeCategoryName('   '), BadRequestException)
})

test('defaults a missing sortOrder to zero', () => {
  assert.equal(normalizeCategorySortOrder(undefined), 0)
})

test('accepts zero and positive safe integers for sortOrder', () => {
  assert.equal(normalizeCategorySortOrder(0), 0)
  assert.equal(normalizeCategorySortOrder(20), 20)
})

test('rejects negative, fractional, unsafe, and non-number sortOrder values', () => {
  for (const value of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, '20', null, [], {}]) {
    assert.throws(() => normalizeCategorySortOrder(value), BadRequestException)
  }
})
