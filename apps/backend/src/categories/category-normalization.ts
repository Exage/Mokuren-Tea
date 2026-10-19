import { BadRequestException } from '@nestjs/common'

const CATEGORY_NAME_MAX_LENGTH = 300
const CATEGORY_SLUG_MAX_LENGTH = 300
const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function assertString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `${field} must be a string`,
    })
  }

  return value
}

// Normalization happens at the input boundary, before pattern and length
// checks. The same rules apply to HTTP and non-HTTP callers so slug and name
// invariants can never diverge between entry points.
export function normalizeCategorySlug(value: unknown): string {
  const raw = assertString(value, 'slug')
  const slug = raw.trim().toLowerCase()

  if (slug.length === 0) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'slug is required',
    })
  }

  if (slug.length > CATEGORY_SLUG_MAX_LENGTH) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `slug must not exceed ${CATEGORY_SLUG_MAX_LENGTH} characters`,
    })
  }

  if (!CATEGORY_SLUG_PATTERN.test(slug)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message:
        'slug must contain lowercase letters, digits and dashes only, and must start and end with a letter or digit',
    })
  }

  return slug
}

export function normalizeCategoryName(value: unknown): string {
  const raw = assertString(value, 'name')
  const name = raw.trim()

  if (name.length === 0) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'name is required',
    })
  }

  if (name.length > CATEGORY_NAME_MAX_LENGTH) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `name must not exceed ${CATEGORY_NAME_MAX_LENGTH} characters`,
    })
  }

  // Display names keep their case and language; only surrounding whitespace
  // is removed.
  return name
}

export function normalizeCategorySortOrder(value: unknown): number {
  if (value === undefined) {
    return 0
  }

  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    !Number.isSafeInteger(value)
  ) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'sortOrder must be a nonnegative safe integer',
    })
  }

  return value
}
