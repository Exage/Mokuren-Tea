import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { Types } from 'mongoose'
import { AdminUserRepository } from '../../dist/auth/admin-user.repository.js'
import { AdminSessionRepository } from '../../dist/auth/admin-session.repository.js'
import { hashSessionToken } from '../../dist/auth/admin-auth.guard.js'
import { startTestApp, stopTestApp } from './setup.mjs'

let app
let replSet
let connection
let db
let userRepository
let sessionRepository

before(async () => {
  const started = await startTestApp('mokuren_admin_users_test')
  app = started.app
  replSet = started.replSet
  connection = started.connection
  db = started.db
  userRepository = app.get(AdminUserRepository)
  sessionRepository = app.get(AdminSessionRepository)

  // Ensure the unique normalizedEmail index exists before the duplicate check.
  // Mongoose autoIndex creates it asynchronously; make it explicit here so the
  // uniqueness assertion is deterministic even under parallel test execution.
  await db.collection('adminusers').createIndex({ normalizedEmail: 1 }, { unique: true })
})

after(async () => {
  await stopTestApp(app, replSet)
})

async function createSession(adminUserId, options = {}) {
  const token = 'test-token-' + String(adminUserId)
  await sessionRepository.create(
    {
      adminUserId: new Types.ObjectId(adminUserId),
      tokenHash: hashSessionToken(token),
      expiresAt: options.expiresAt || new Date(Date.now() + 7 * 24 * 3600 * 1000),
      revokedAt: options.revokedAt || null,
    },
    null
  )
  return token
}

test('creates an admin user and enforces normalizedEmail uniqueness', async () => {
  const adminUserId = new Types.ObjectId()
  const session = await connection.startSession()

  try {
    await session.withTransaction(async () => {
      await userRepository.create(
        {
          _id: adminUserId,
          email: 'Admin@Example.COM',
          normalizedEmail: 'admin@example.com',
          displayName: 'Administrator',
          passwordHash: 'argon2id$hash',
          mustChangePassword: false,
          temporaryPasswordExpiresAt: null,
          isActive: true,
          createdBy: null,
          lastLoginAt: null,
        },
        session
      )
    })
  } finally {
    await session.endSession()
  }

  const byEmail = await userRepository.findByNormalizedLogin('admin@example.com')
  assert.ok(byEmail)
  assert.equal(byEmail.displayName, 'Administrator')
  assert.equal(byEmail.email, 'Admin@Example.COM')

  const absent = await userRepository.findByNormalizedLogin('other@example.com')
  assert.equal(absent, null, 'a different normalized email is absent')

  const duplicateId = new Types.ObjectId()
  await assert.rejects(
    () =>
      userRepository.create(
        {
          _id: duplicateId,
          email: 'admin@example.com',
          normalizedEmail: 'admin@example.com',
          displayName: 'Duplicate',
          passwordHash: 'argon2id$hash',
          mustChangePassword: false,
          temporaryPasswordExpiresAt: null,
          isActive: true,
          createdBy: null,
          lastLoginAt: null,
        },
        null
      ),
    /11000/
  )
})

test('session repository stores token hash and persists revocations', async () => {
  const adminUserId = new Types.ObjectId()
  const token = await createSession(adminUserId)

  const session = await db
    .collection('adminsessions')
    .findOne({ tokenHash: hashSessionToken(token) })
  assert.ok(session)
  assert.equal(String(session.adminUserId), String(adminUserId))
  assert.ok(!session.revokedAt)

  await sessionRepository.revoke(hashSessionToken(token), null)
  const revoked = await db
    .collection('adminsessions')
    .findOne({ tokenHash: hashSessionToken(token) })
  assert.ok(revoked.revokedAt)

  await sessionRepository.revokeAllForUser(adminUserId, null)
  const all = await db.collection('adminsessions').find({ adminUserId }).toArray()
  assert.equal(all.length, 1)
  assert.ok(
    all.every((s) => s.revokedAt),
    'every session for the user is revoked'
  )
})
