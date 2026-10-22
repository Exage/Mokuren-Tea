import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { Types } from 'mongoose'
import { AuthService } from '../../dist/auth/auth.service.js'
import { AdminUserRepository } from '../../dist/auth/admin-user.repository.js'
import { AdminSessionRepository } from '../../dist/auth/admin-session.repository.js'
import { hashSessionToken } from '../../dist/auth/admin-auth.guard.js'
import { encodeCredential, hashPassword } from '../../dist/auth/password.js'
import { startTestApp, stopTestApp } from './setup.mjs'

async function assertInvalidCredentials(fn) {
  let threw = false

  try {
    await fn()
  } catch (error) {
    threw = true
    assert.equal(error.message, 'Invalid email or password')
    assert.equal(error.response?.code ?? error.code, 'INVALID_CREDENTIALS')
  }

  assert.equal(threw, true, 'expected an INVALID_CREDENTIALS error')
}

let app
let replSet
let db
let authService
let userRepository
let sessionRepository

const ADMIN_EMAIL = 'admin@example.com'
const ADMIN_PASSWORD = 'Password123'

before(async () => {
  const started = await startTestApp('mokuren_auth_service_test')
  app = started.app
  replSet = started.replSet
  db = started.db
  authService = app.get(AuthService)
  userRepository = app.get(AdminUserRepository)
  sessionRepository = app.get(AdminSessionRepository)

  const { hash, salt } = hashPassword(ADMIN_PASSWORD)
  const adminId = new Types.ObjectId()
  await userRepository.create(
    {
      _id: adminId,
      email: ADMIN_EMAIL,
      normalizedEmail: ADMIN_EMAIL,
      displayName: 'Administrator',
      passwordHash: encodeCredential(hash, salt),
      mustChangePassword: false,
      temporaryPasswordExpiresAt: null,
      isActive: true,
      createdBy: null,
      lastLoginAt: null,
    },
    null
  )
})

after(async () => {
  await stopTestApp(app, replSet)
})

test('login returns a safe profile and a server session token', async () => {
  const { user, token } = await authService.login(ADMIN_EMAIL, ADMIN_PASSWORD)

  assert.equal(user.email, ADMIN_EMAIL)
  assert.equal(user.displayName, 'Administrator')
  assert.equal(user.mustChangePassword, false)
  assert.ok(typeof user.id === 'string' && user.id.length > 0)
  assert.ok(typeof token === 'string' && token.length > 0)

  const userRecord = await userRepository.findByNormalizedEmail(ADMIN_EMAIL)
  assert.ok(userRecord.lastLoginAt)
})

test('login rejects wrong password with a generic credential error', async () => {
  await assertInvalidCredentials(() => authService.login(ADMIN_EMAIL, 'wrong-password'))
})

test('login rejects an unknown email with the same generic error', async () => {
  await assertInvalidCredentials(() => authService.login('nobody@example.com', ADMIN_PASSWORD))
})

test('login rejects an inactive account with the same generic error', async () => {
  const inactiveId = new Types.ObjectId()
  const { hash, salt } = hashPassword(ADMIN_PASSWORD)
  await userRepository.create(
    {
      _id: inactiveId,
      email: 'inactive@example.com',
      normalizedEmail: 'inactive@example.com',
      displayName: 'Inactive',
      passwordHash: encodeCredential(hash, salt),
      mustChangePassword: false,
      temporaryPasswordExpiresAt: null,
      isActive: false,
      createdBy: null,
      lastLoginAt: null,
    },
    null
  )

  await assertInvalidCredentials(() => authService.login('inactive@example.com', ADMIN_PASSWORD))
})

test('login accepts a valid temporary password and flags mustChangePassword', async () => {
  const tempId = new Types.ObjectId()
  const { hash, salt } = hashPassword('temporary-123')
  const future = new Date(Date.now() + 7 * 24 * 3600 * 1000)
  await userRepository.create(
    {
      _id: tempId,
      email: 'temp@example.com',
      normalizedEmail: 'temp@example.com',
      displayName: 'Temp',
      passwordHash: encodeCredential(hash, salt),
      mustChangePassword: true,
      temporaryPasswordExpiresAt: future,
      isActive: true,
      createdBy: null,
      lastLoginAt: null,
    },
    null
  )

  const { user, token } = await authService.login('temp@example.com', 'temporary-123')
  assert.equal(user.mustChangePassword, true)
  assert.ok(typeof token === 'string' && token.length > 0)
})

test('login rejects an expired temporary password', async () => {
  const expiredId = new Types.ObjectId()
  const { hash, salt } = hashPassword('expired-temp')
  const past = new Date(Date.now() - 7 * 24 * 3600 * 1000)
  await userRepository.create(
    {
      _id: expiredId,
      email: 'expired@example.com',
      normalizedEmail: 'expired@example.com',
      displayName: 'Expired',
      passwordHash: encodeCredential(hash, salt),
      mustChangePassword: true,
      temporaryPasswordExpiresAt: past,
      isActive: true,
      createdBy: null,
      lastLoginAt: null,
    },
    null
  )

  await assertInvalidCredentials(() => authService.login('expired@example.com', 'expired-temp'))
})

test('changePassword rejects a wrong current password, then succeeds and rotates sessions', async () => {
  await assertInvalidCredentials(async () =>
    authService.changePassword(
      String((await userRepository.findByNormalizedEmail(ADMIN_EMAIL))._id),
      'wrong-current',
      'NewPassword123'
    )
  )

  const userRecord = await userRepository.findByNormalizedEmail(ADMIN_EMAIL)
  const oldToken = 'old-session-token'
  await sessionRepository.create(
    {
      adminUserId: userRecord._id,
      tokenHash: hashSessionToken(oldToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      revokedAt: null,
    },
    null
  )

  const { user, token } = await authService.changePassword(
    String(userRecord._id),
    ADMIN_PASSWORD,
    'NewPassword123'
  )

  assert.equal(user.mustChangePassword, false)
  assert.ok(typeof token === 'string' && token.length > 0)

  // The previous session is revoked and a fresh non-revoked session exists.
  const afterSessions = await db
    .collection('adminsessions')
    .find({ adminUserId: userRecord._id })
    .toArray()
  const oldSession = afterSessions.find((s) => s.tokenHash === hashSessionToken(oldToken))
  assert.ok(oldSession)
  assert.ok(oldSession.revokedAt)
  assert.ok(afterSessions.some((s) => !s.revokedAt))

  // The new password works and issues another session.
  const { token: nextToken } = await authService.login(ADMIN_EMAIL, 'NewPassword123')
  assert.ok(typeof nextToken === 'string' && nextToken.length > 0)
})
