export type PublicationViolationCode =
  'NAME_MISSING' | 'CATEGORY_INVALID' | 'IMAGE_MISSING' | 'VARIANT_MISSING'

export interface PublicationViolation {
  code: PublicationViolationCode
  message: string
}

export interface PublicationVariantInput {
  weightGrams: number
  price: ProductPrice
  enabled: boolean
}

export interface PublicationCheckInput {
  name: unknown
  categoryExists: boolean
  imageCount: number
  variants: PublicationVariantInput[]
}

export interface PublicationCheckResult {
  ready: boolean
  violations: PublicationViolation[]
}

function isValidVariant(variant: PublicationVariantInput): boolean {
  if (!variant.enabled) {
    return false
  }

  if (!Number.isInteger(variant.weightGrams) || variant.weightGrams <= 0) {
    return false
  }

  if (!isValidProductPrice(variant.price)) {
    return false
  }

  return true
}

// Pure readiness check: the caller verifies referenced records in MongoDB
// beforehand and passes the outcome as plain booleans/counters.
export function checkProductPublication(input: PublicationCheckInput): PublicationCheckResult {
  const violations: PublicationViolation[] = []

  if (typeof input.name !== 'string' || input.name.trim().length === 0) {
    violations.push({ code: 'NAME_MISSING', message: 'Product name is required for publication' })
  }

  if (!input.categoryExists) {
    violations.push({
      code: 'CATEGORY_INVALID',
      message: 'A valid category is required for publication',
    })
  }

  if (!Number.isInteger(input.imageCount) || input.imageCount < 1) {
    violations.push({
      code: 'IMAGE_MISSING',
      message: 'At least one photo is required for publication',
    })
  }

  const hasValidVariant =
    Array.isArray(input.variants) && input.variants.some((variant) => isValidVariant(variant))

  if (!hasValidVariant) {
    violations.push({
      code: 'VARIANT_MISSING',
      message: 'At least one enabled variant with valid weight and price is required',
    })
  }

  return { ready: violations.length === 0, violations }
}
import { isValidProductPrice, ProductPrice } from './product-price.js'
