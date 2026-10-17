import { compareProductPrices, isValidProductPrice, ProductPrice } from './product-price.js'

export interface AvailabilityVariantInput {
  weightGrams: number
  price: ProductPrice
  enabled: boolean
}

export function getAvailableGrams(physicalGrams: number, reservedGrams: number): number {
  return physicalGrams - reservedGrams
}

export function canReserveVariant(
  variant: AvailabilityVariantInput,
  availableGrams: number
): boolean {
  if (!variant.enabled) {
    return false
  }

  if (!Number.isInteger(variant.weightGrams) || variant.weightGrams <= 0) {
    return false
  }

  if (!Number.isInteger(availableGrams)) {
    return false
  }

  return availableGrams >= variant.weightGrams
}

// Catalog card price: minimum among enabled variants with a valid price.
// Stock sufficiency is intentionally ignored here.
export function getMinimumPrice(variants: AvailabilityVariantInput[]): ProductPrice | null {
  let minimum: ProductPrice | null = null

  for (const variant of variants) {
    if (!variant.enabled) {
      continue
    }

    if (!isValidProductPrice(variant.price)) {
      continue
    }

    if (!minimum || compareProductPrices(variant.price, minimum) < 0) {
      minimum = variant.price
    }
  }

  return minimum
}

// Out of stock when there are no grams at all or no enabled variant fits
// into the remaining stock. Exact gram values stay inside the backend.
export function isOutOfStock(
  variants: AvailabilityVariantInput[],
  availableGrams: number
): boolean {
  if (!Number.isInteger(availableGrams) || availableGrams <= 0) {
    return true
  }

  for (const variant of variants) {
    if (canReserveVariant(variant, availableGrams)) {
      return false
    }
  }

  return true
}
