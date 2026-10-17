import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Types } from 'mongoose'
import {
  canReserveVariant,
  getAvailableGrams,
  getMinimumPrice,
  isOutOfStock,
} from '../dist/products/domain/product-availability.js'

const price = (value) => Types.Decimal128.fromString(String(value))

test('computes available grams as physical minus reserved', () => {
  assert.equal(getAvailableGrams(500, 150), 350)
  assert.equal(getAvailableGrams(0, 0), 0)
})

test('finds the minimum price among enabled variants only', () => {
  assert.equal(
    getMinimumPrice([
      { weightGrams: 50, price: price(21.9), enabled: true },
      { weightGrams: 100, price: price(39.9), enabled: true },
      { weightGrams: 25, price: price(9.9), enabled: false },
    ]).toString(),
    '21.9'
  )
})

test('returns null when no enabled variant has a price', () => {
  assert.equal(getMinimumPrice([]), null)
  assert.equal(getMinimumPrice([{ weightGrams: 50, price: price(21.9), enabled: false }]), null)
})

test('allows reservation on an exact weight match', () => {
  assert.equal(canReserveVariant({ weightGrams: 50, price: price(21.9), enabled: true }, 50), true)
})

test('denies reservation for disabled variants or insufficient stock', () => {
  assert.equal(
    canReserveVariant({ weightGrams: 50, price: price(21.9), enabled: false }, 500),
    false
  )
  assert.equal(
    canReserveVariant({ weightGrams: 100, price: price(21.9), enabled: true }, 75),
    false
  )
})

test('reports out of stock when no enabled variant fits the remaining stock', () => {
  assert.equal(isOutOfStock([{ weightGrams: 1000, price: price(21.9), enabled: true }], 500), true)
  assert.equal(isOutOfStock([{ weightGrams: 100, price: price(21.9), enabled: true }], 0), true)
  assert.equal(isOutOfStock([{ weightGrams: 100, price: price(21.9), enabled: false }], 500), true)
})

test('keeps the minimum price independent of stock sufficiency', () => {
  const variants = [{ weightGrams: 500, price: price(21.9), enabled: true }]
  assert.equal(getMinimumPrice(variants).toString(), '21.9')
  assert.equal(isOutOfStock(variants, 100), true)
})
