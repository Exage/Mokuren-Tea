import { Types } from 'mongoose'

export type ProductPrice = Types.Decimal128

const PRICE_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/

function decimalText(value: ProductPrice): string {
  return value.toString()
}

export function toProductPrice(value: number): ProductPrice {
  const text = String(value)

  if (!PRICE_PATTERN.test(text)) {
    throw new Error('Price must have no more than two decimal places')
  }

  return Types.Decimal128.fromString(text)
}

export function isValidProductPrice(value: unknown): value is ProductPrice {
  if (!value || typeof value !== 'object' || !('toString' in value)) {
    return false
  }

  const text = String(value)

  if (!PRICE_PATTERN.test(text)) {
    return false
  }

  return Number(text) > 0
}

export function productPriceToNumber(value: ProductPrice): number {
  return Number(decimalText(value))
}

export function compareProductPrices(left: ProductPrice, right: ProductPrice): number {
  const toCents = (value: ProductPrice): bigint => {
    const [whole = '0', fraction = ''] = decimalText(value).split('.')
    const cents = `${fraction}00`.slice(0, 2)
    return BigInt(whole) * 100n + BigInt(cents)
  }
  const leftCents = toCents(left)
  const rightCents = toCents(right)

  if (leftCents < rightCents) {
    return -1
  }

  if (leftCents > rightCents) {
    return 1
  }

  return 0
}
