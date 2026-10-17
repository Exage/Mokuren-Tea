import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Types } from 'mongoose'
import { checkProductPublication } from '../dist/products/domain/product-publication.js'

const validVariant = {
  weightGrams: 50,
  price: Types.Decimal128.fromString('21.9'),
  enabled: true,
}

function input(overrides = {}) {
  return {
    name: 'Milk Oolong',
    categoryExists: true,
    imageCount: 1,
    variants: [{ ...validVariant }],
    ...overrides,
  }
}

test('approves a fully prepared product for publication', () => {
  const result = checkProductPublication(input())
  assert.equal(result.ready, true)
  assert.deepEqual(result.violations, [])
})

test('rejects a missing or blank name with NAME_MISSING', () => {
  for (const name of ['', '   ', null, undefined]) {
    const result = checkProductPublication(input({ name }))
    assert.equal(result.ready, false)
    assert.ok(result.violations.some((violation) => violation.code === 'NAME_MISSING'))
  }
})

test('rejects an invalid category with CATEGORY_INVALID', () => {
  const result = checkProductPublication(input({ categoryExists: false }))
  assert.equal(result.ready, false)
  assert.deepEqual(
    result.violations.map((violation) => violation.code),
    ['CATEGORY_INVALID']
  )
})

test('rejects a product without photos with IMAGE_MISSING', () => {
  const result = checkProductPublication(input({ imageCount: 0 }))
  assert.equal(result.ready, false)
  assert.ok(result.violations.some((violation) => violation.code === 'IMAGE_MISSING'))
})

test('rejects a product without an enabled valid variant', () => {
  const cases = [
    [],
    [{ ...validVariant, enabled: false }],
    [{ ...validVariant, weightGrams: 0 }],
    [{ ...validVariant, weightGrams: -50 }],
    [{ ...validVariant, price: Types.Decimal128.fromString('0') }],
  ]

  for (const variants of cases) {
    const result = checkProductPublication(input({ variants }))
    assert.equal(result.ready, false)
    assert.ok(
      result.violations.some((violation) => violation.code === 'VARIANT_MISSING'),
      `expected VARIANT_MISSING for ${JSON.stringify(variants)}`
    )
  }
})

test('returns every violation at once', () => {
  const result = checkProductPublication(
    input({ name: '  ', categoryExists: false, imageCount: 0, variants: [] })
  )
  assert.equal(result.ready, false)
  assert.deepEqual(result.violations.map((violation) => violation.code).sort(), [
    'CATEGORY_INVALID',
    'IMAGE_MISSING',
    'NAME_MISSING',
    'VARIANT_MISSING',
  ])
})

test('ignores disabled variants when an enabled one exists', () => {
  const result = checkProductPublication(
    input({
      variants: [{ ...validVariant, enabled: false }, { ...validVariant }],
    })
  )
  assert.equal(result.ready, true)
})
