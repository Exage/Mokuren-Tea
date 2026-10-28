import { argon2Sync, randomBytes } from 'node:crypto'

export interface HashedPassword {
  hash: string
  salt: string
}

// Argon2id parameters. memory is in KiB, passes is the iteration count. These
// values make brute-force attacks expensive while remaining practical for a
// sign-in flow. Kept configurable through a single constant so operators can
// tighten them without touching call sites.
const ARGON2ID_PARAMETERS = {
  tagLength: 32,
  passes: 3,
  memory: 65536,
  parallelism: 4,
  type: 'argon2id' as const,
}

// Password policy. Reasonable, documented defaults; operators can tighten them
// through configuration without changing code.
export const DEFAULT_PASSWORD_MIN_LENGTH = 8
export const DEFAULT_PASSWORD_MAX_LENGTH = 128

export function validatePassword(
  password: string,
  minLength: number = DEFAULT_PASSWORD_MIN_LENGTH,
  maxLength: number = DEFAULT_PASSWORD_MAX_LENGTH
): void {
  if (password.length < minLength) {
    throw new Error(`password must be at least ${minLength} characters`)
  }

  if (password.length > maxLength) {
    throw new Error(`password must not exceed ${maxLength} characters`)
  }
}

export function hashPassword(password: string): HashedPassword {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('password is required')
  }

  // A fresh random salt per password ensures identical passwords hash
  // differently and precomputation is infeasible.
  const salt = randomBytes(16)
  const derived = argon2Sync('argon2id', {
    message: password,
    nonce: salt,
    ...ARGON2ID_PARAMETERS,
  })

  return { hash: derived.toString('hex'), salt: salt.toString('hex') }
}

export function verifyPassword(password: string, stored: HashedPassword): boolean {
  if (typeof password !== 'string' || password.length === 0) {
    return false
  }

  if (typeof stored?.hash !== 'string' || typeof stored?.salt !== 'string') {
    return false
  }

  const salt = Buffer.from(stored.salt, 'hex')
  if (salt.length === 0) {
    return false
  }

  const derived = argon2Sync('argon2id', {
    message: password,
    nonce: salt,
    ...ARGON2ID_PARAMETERS,
  })

  return derived.toString('hex') === stored.hash
}

// Pack a hash and its salt into a single string for the passwordHash column.
// Salt and hash are hex (no dots), so splitting on the last dot is unambiguous.
export function encodeCredential(hash: string, salt: string): string {
  return `${salt}.${hash}`
}

export function parseCredential(stored: string): HashedPassword | null {
  const separator = stored.lastIndexOf('.')
  if (separator <= 0 || separator === stored.length - 1) {
    return null
  }
  return { salt: stored.slice(0, separator), hash: stored.slice(separator + 1) }
}

// Logins are case-insensitive and do not need to be email addresses. Preserve
// all characters except surrounding whitespace; passwords are never modified.
export function normalizeLogin(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('login must be a string')
  }

  const login = value.trim().toLowerCase()

  if (login.length === 0) {
    throw new Error('login is required')
  }

  if (login.length > 300) {
    throw new Error('login must not exceed 300 characters')
  }

  return login
}
