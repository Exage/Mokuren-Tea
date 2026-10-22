import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { randomBytes } from 'node:crypto'
import { Types } from 'mongoose'
import request from 'supertest'
import { hashPassword, encodeCredential } from '../../dist/auth/password.js'
import { hashSessionToken } from '../../dist/auth/admin-auth.guard.js'
import { startTestApp, stopTestApp } from './setup.mjs'
import { AdminUsersService } from '../../dist/auth/admin-users.service.js'
import { AuditService } from '../../dist/audit/audit.service.js'

let app
let replSet
let db
let managerId

const ADMIN_PASS = 'AdminPass1'

function cookieValue(headers, name) {
  const raw = headers['set-cookie']
  if (!raw) {
    return null
  }
  const list = Array.isArray(raw) ? raw : [raw]
  for (const entry of list) {
    const match = entry.match(new RegExp(`^${name}=([^;]*);`))
    if (match) {
      return match[1]
    }
  }
  return null
}

async function insertAdmin(email, displayName, password = ADMIN_PASS, isActive = true) {
  const { hash, salt } = hashPassword(password)
  const id = new Types.ObjectId()
  await db.collection('adminusers').insertOne({
    _id: id,
    email,
    normalizedEmail: email.toLowerCase(),
    displayName,
    passwordHash: encodeCredential(hash, salt),
    mustChangePassword: false,
    temporaryPasswordExpiresAt: null,
    isActive,
    createdBy: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  return String(id)
}

// Inserts a server-side session directly into the database, bypassing the
// rate-limited login endpoint. Used by tests that only need an authenticated
// session and do not exercise the login flow itself. Returns the raw token
// (not a cookie string) so callers can build the Cookie header themselves.
async function authCookie(adminId) {
  const token = randomBytes(16).toString('hex')
  await db.collection('adminsessions').insertOne({
    _id: new Types.ObjectId(),
    adminUserId: new Types.ObjectId(adminId),
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    revokedAt: null,
  })
  return token
}

// Creates a spare active administrator and returns its session cookie, for
// tests that run after the concurrent-deactivation test (which deactivates
// most other administrators). Uses a unique email to avoid duplicate-key
// errors when called multiple times.
let spareCounter = 0
async function spareCookie() {
  const id = await insertAdmin(`spare-${spareCounter++}@example.com`, 'Spare')
  return authCookie(id)
}

// Returns Cookie and X-CSRF-Token headers for state-changing requests. The
// client must first obtain a csrf_token cookie via GET /csrf-token.
async function csrfHeaders(sessionCookie) {
  const tokenRes = await request(app.getHttpServer()).get('/api/admin/auth/csrf-token')
  const csrfToken = cookieValue(tokenRes.headers, 'csrf_token')
  assert.ok(csrfToken)
  return {
    cookie: `csrf_token=${csrfToken}; admin_session=${sessionCookie}`,
    'x-csrf-token': csrfToken,
  }
}

async function assertSafeUser(body, expectedEmail, expectedDisplayName) {
  assert.equal(body.email, expectedEmail)
  assert.equal(body.displayName, expectedDisplayName)
  assert.ok(typeof body.id === 'string' && body.id.length > 0)
  assert.ok(typeof body.isActive === 'boolean')
  assert.ok(!body.passwordHash)
  assert.ok(!body.temporaryPassword)
}

before(async () => {
  const started = await startTestApp('mokuren_admin_management_test')
  app = started.app
  replSet = started.replSet
  db = started.db

  // Ensure the unique normalizedEmail index exists (mirrors the AdminUser
  // schema index) so duplicate-email assertions are deterministic.
  await db.collection('adminusers').createIndex({ normalizedEmail: 1 }, { unique: true })

  // Seed one administrator used to manage others.
  managerId = await insertAdmin('manager@example.com', 'Manager')
  // A second administrator that stays active for tests that need a session
  // after other tests deactivate the manager.
  await insertAdmin('operator@example.com', 'Operator')
})

after(async () => {
  await stopTestApp(app, replSet)
})

test('create returns a safe profile and a temporary password only once', async () => {
  const session = await authCookie(managerId)
  const headers = await csrfHeaders(session)

  const res = await request(app.getHttpServer())
    .post('/api/admin/users')
    .set('Cookie', headers.cookie)
    .set('X-CSRF-Token', headers['x-csrf-token'])
    .send({ email: 'newbie@example.com', displayName: 'Newbie' })

  assert.equal(res.status, 201)
  assertSafeUser(res.body.user, 'newbie@example.com', 'Newbie')
  assert.equal(res.body.user.mustChangePassword, true)
  assert.ok(typeof res.body.temporaryPassword === 'string' && res.body.temporaryPassword.length > 0)
  assert.ok(res.body.temporaryPasswordExpiresAt)

  // The temporary password works for login and flags mustChangePassword.
  const newbieCsrf = await (async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/auth/csrf-token')
    return cookieValue(res.headers, 'csrf_token')
  })()
  const login = await request(app.getHttpServer())
    .post('/api/admin/auth/login')
    .set('Cookie', `csrf_token=${newbieCsrf}`)
    .set('X-CSRF-Token', newbieCsrf)
    .send({ email: 'newbie@example.com', password: res.body.temporaryPassword })
  assert.equal(login.status, 200)
  assert.equal(login.body.mustChangePassword, true)

  // But a temporary-password session cannot use management endpoints.
  const meCookie = cookieValue(login.headers, 'admin_session')
  const meHdrs = await csrfHeaders(meCookie)
  const forbidden = await request(app.getHttpServer())
    .get('/api/admin/users')
    .set('Cookie', meHdrs.cookie)
    .set('X-CSRF-Token', meHdrs['x-csrf-token'])
  assert.equal(forbidden.status, 403)
  assert.equal(forbidden.body.code, 'PASSWORD_CHANGE_REQUIRED')
})

test('create rejects a duplicate normalized email', async () => {
  const session = await authCookie(managerId)
  const headers = await csrfHeaders(session)

  await request(app.getHttpServer())
    .post('/api/admin/users')
    .set('Cookie', headers.cookie)
    .set('X-CSRF-Token', headers['x-csrf-token'])
    .send({ email: 'dup@example.com', displayName: 'Dup' })
    .then((res) => assert.equal(res.status, 201))

  const conflict = await request(app.getHttpServer())
    .post('/api/admin/users')
    .set('Cookie', headers.cookie)
    .set('X-CSRF-Token', headers['x-csrf-token'])
    .send({ email: 'DUP@EXAMPLE.COM', displayName: 'Dup2' })

  assert.equal(conflict.status, 409)
  assert.equal(conflict.body.code, 'CONFLICT')
  assert.equal(await db.collection('adminusers').countDocuments({ normalizedEmail: 'dup@example.com' }), 1)
})

test('list excludes password hashes and temporary passwords', async () => {
  const session = await authCookie(managerId)
  const headers = await csrfHeaders(session)

  await request(app.getHttpServer())
    .post('/api/admin/users')
    .set('Cookie', headers.cookie)
    .set('X-CSRF-Token', headers['x-csrf-token'])
    .send({ email: 'lister@example.com', displayName: 'Lister' })

  const list = await request(app.getHttpServer())
    .get('/api/admin/users')
    .set('Cookie', `admin_session=${session}`)

  assert.equal(list.status, 200)
  assert.ok(Array.isArray(list.body.items))
  assert.ok(list.body.items.some((u) => u.email === 'lister@example.com'))
  for (const user of list.body.items) {
    assert.ok(!user.passwordHash)
    assert.ok(!user.temporaryPassword)
  }
})

test('update changes permitted fields only', async () => {
  const session = await authCookie(managerId)
  const headers = await csrfHeaders(session)
  const created = await request(app.getHttpServer())
    .post('/api/admin/users')
    .set('Cookie', headers.cookie)
    .set('X-CSRF-Token', headers['x-csrf-token'])
    .send({ email: 'updater@example.com', displayName: 'Before' })
  assert.equal(created.status, 201)
  const id = created.body.user.id

  const session2 = await authCookie(managerId)
  const headers2 = await csrfHeaders(session2)
  const res = await request(app.getHttpServer())
    .patch(`/api/admin/users/${id}`)
    .set('Cookie', headers2.cookie)
    .set('X-CSRF-Token', headers2['x-csrf-token'])
    .send({ displayName: 'After' })

  assert.equal(res.status, 200)
  assert.equal(res.body.displayName, 'After')
  assert.equal(res.body.email, 'updater@example.com')

  const stored = await db.collection('adminusers').findOne({ _id: new Types.ObjectId(id) })
  assert.equal(stored.displayName, 'After')
})

test('account updates recover from a legacy stranded lock and release on transaction abort', async (t) => {
  const locks = db.collection('admin_mutation_locks')
  await locks.updateOne(
    { _id: new Types.ObjectId('000000000000000000000000') },
    { $set: { holder: 'crashed-process' } },
    { upsert: true },
  )
  const service = app.get(AdminUsersService)
  const audit = t.mock.method(app.get(AuditService), 'record', async () => {
    throw new Error('Audit write failed')
  })
  await assert.rejects(
    service.updateUser(managerId, { displayName: 'Must roll back' }, managerId),
    /Audit write failed/,
  )
  audit.mock.restore()
  const stored = await db.collection('adminusers').findOne({ _id: new Types.ObjectId(managerId) })
  assert.equal(stored.displayName, 'Manager')

  const updated = await service.updateUser(managerId, { displayName: 'Recovered' }, managerId)
  assert.equal(updated.displayName, 'Recovered')
  await service.updateUser(managerId, { displayName: 'Manager' }, managerId)
})

test('update rejects empty body and unknown fields are ignored', async () => {
  const session = await authCookie(managerId)
  const headers = await csrfHeaders(session)
  const created = await request(app.getHttpServer())
    .post('/api/admin/users')
    .set('Cookie', headers.cookie)
    .set('X-CSRF-Token', headers['x-csrf-token'])
    .send({ email: 'noop@example.com', displayName: 'Noop' })
  assert.equal(created.status, 201)
  const id = created.body.user.id

  const session2 = await authCookie(managerId)
  const headers2 = await csrfHeaders(session2)

  const empty = await request(app.getHttpServer())
    .patch(`/api/admin/users/${id}`)
    .set('Cookie', headers2.cookie)
    .set('X-CSRF-Token', headers2['x-csrf-token'])
    .send({})
  assert.equal(empty.status, 400)

  const storedBefore = await db.collection('adminusers').findOne({ _id: new Types.ObjectId(id) })
  assert.equal(storedBefore.isActive, true)
})

test('deactivation revokes all sessions and cannot deactivate oneself', async () => {
  const targetId = await insertAdmin('target@example.com', 'Target')
  const targetSession = await authCookie(targetId)

  // Deactivate the target using the manager's session.
  const managerSession = await authCookie(managerId)
  const headers = await csrfHeaders(managerSession)

  const res = await request(app.getHttpServer())
    .patch(`/api/admin/users/${targetId}`)
    .set('Cookie', headers.cookie)
    .set('X-CSRF-Token', headers['x-csrf-token'])
    .send({ isActive: false })

  assert.equal(res.status, 200)
  assert.equal(res.body.isActive, false)

  // The target's session is revoked.
  const me = await request(app.getHttpServer())
    .get('/api/admin/auth/me')
    .set('Cookie', `admin_session=${targetSession}`)
  assert.equal(me.status, 401)

  // An administrator cannot deactivate themself.
  const self = await request(app.getHttpServer())
    .patch(`/api/admin/users/${managerId.toUpperCase()}`)
    .set('Cookie', headers.cookie)
    .set('X-CSRF-Token', headers['x-csrf-token'])
    .send({ isActive: false })
  assert.equal(self.status, 403)
  assert.equal(self.body.code, 'FORBIDDEN')
})

test('reset-password issues a new temporary password and revokes sessions', async () => {
  const targetId = await insertAdmin('resetter@example.com', 'Resetter')
  const targetSession = await authCookie(targetId)

  const managerSession = await authCookie(managerId)
  const headers = await csrfHeaders(managerSession)

  const res = await request(app.getHttpServer())
    .post(`/api/admin/users/${targetId}/reset-password`)
    .set('Cookie', headers.cookie)
    .set('X-CSRF-Token', headers['x-csrf-token'])

  assert.equal(res.status, 200)
  assert.equal(res.body.user.mustChangePassword, true)
  assert.ok(typeof res.body.temporaryPassword === 'string' && res.body.temporaryPassword.length > 0)

  // The old session is revoked.
  const me = await request(app.getHttpServer())
    .get('/api/admin/auth/me')
    .set('Cookie', `admin_session=${targetSession}`)
  assert.equal(me.status, 401)

  // The new temporary password works for login.
  const loginCsrf = await (async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/auth/csrf-token')
    return cookieValue(res.headers, 'csrf_token')
  })()
  const login = await request(app.getHttpServer())
    .post('/api/admin/auth/login')
    .set('Cookie', `csrf_token=${loginCsrf}`)
    .set('X-CSRF-Token', loginCsrf)
    .send({ email: 'resetter@example.com', password: res.body.temporaryPassword })
  assert.equal(login.status, 200)
})

test('revoke-sessions revokes every session for an administrator', async () => {
  const targetId = await insertAdmin('revokee@example.com', 'Revokee')

  // Create two sessions for the target.
  const token1 = 'revoke-session-one'
  const token2 = 'revoke-session-two'
  const { hashSessionToken } = await import('../../dist/auth/admin-auth.guard.js')
  await db.collection('adminsessions').insertMany([
    { adminUserId: new Types.ObjectId(targetId), tokenHash: hashSessionToken(token1), expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000), revokedAt: null },
    { adminUserId: new Types.ObjectId(targetId), tokenHash: hashSessionToken(token2), expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000), revokedAt: null },
  ])

  const managerSession = await authCookie(managerId)
  const headers = await csrfHeaders(managerSession)

  const res = await request(app.getHttpServer())
    .post(`/api/admin/users/${targetId}/revoke-sessions`)
    .set('Cookie', headers.cookie)
    .set('X-CSRF-Token', headers['x-csrf-token'])

  assert.equal(res.status, 200)
  assert.equal(res.body.revokedCount, 2)

  const remaining = await db.collection('adminsessions').countDocuments({
    adminUserId: new Types.ObjectId(targetId),
    revokedAt: null,
  })
  assert.equal(remaining, 0)

  const repeated = await request(app.getHttpServer())
    .post(`/api/admin/users/${targetId}/revoke-sessions`)
    .set('Cookie', headers.cookie)
    .set('X-CSRF-Token', headers['x-csrf-token'])
  assert.equal(repeated.status, 200)
  assert.equal(repeated.body.revokedCount, 0)
})

test('audit records mutations without secrets', async () => {
  const managerSession = await authCookie(managerId)
  const headers = await csrfHeaders(managerSession)

  const beforeCount = await db.collection('auditlogs').countDocuments()

  const created = await request(app.getHttpServer())
    .post('/api/admin/users')
    .set('Cookie', headers.cookie)
    .set('X-CSRF-Token', headers['x-csrf-token'])
    .send({ email: 'audit@example.com', displayName: 'Audit' })
  assert.equal(created.status, 201)

  const audit = await db.collection('auditlogs').findOne({
    action: 'admin-user.created',
    entityType: 'admin-user',
  })
  assert.ok(audit)
  assert.equal(audit.actorId, managerId)
  assert.ok(!audit.changes || audit.changes.passwordHash === undefined)
  assert.ok(!audit.changes || audit.changes.temporaryPassword === undefined)
  assert.equal(await db.collection('auditlogs').countDocuments(), beforeCount + 1)
})

test('concurrent deactivations cannot drive the active count to zero', async () => {
  const xId = await insertAdmin('concurrent-x@example.com', 'Concurrent X')
  const yId = await insertAdmin('concurrent-y@example.com', 'Concurrent Y')

  const sessionX = await authCookie(xId)
  const sessionY = await authCookie(yId)
  const xHeaders = await csrfHeaders(sessionX)

  // Deactivate every other active administrator so exactly X and Y remain.
  const allUsers = await request(app.getHttpServer())
    .get('/api/admin/users')
    .set('Cookie', `admin_session=${sessionX}`)
  const toDeactivate = allUsers.body.items.filter(
    (u) => u.id !== xId && u.id !== yId,
  )
  for (const u of toDeactivate) {
    await request(app.getHttpServer())
      .patch(`/api/admin/users/${u.id}`)
      .set('Cookie', xHeaders.cookie)
      .set('X-CSRF-Token', xHeaders['x-csrf-token'])
      .send({ isActive: false })
  }

  assert.equal(await db.collection('adminusers').countDocuments({ isActive: true }), 2)

  // Obtain a single CSRF token shared by both concurrent requests.
  const tokenRes = await request(app.getHttpServer()).get('/api/admin/auth/csrf-token')
  const csrfToken = cookieValue(tokenRes.headers, 'csrf_token')
  assert.ok(csrfToken)

  const headersX = { cookie: `csrf_token=${csrfToken}; admin_session=${sessionX}`, 'x-csrf-token': csrfToken }
  const headersY = { cookie: `csrf_token=${csrfToken}; admin_session=${sessionY}`, 'x-csrf-token': csrfToken }

  const [xRes, yRes] = await Promise.all([
    request(app.getHttpServer())
      .patch(`/api/admin/users/${yId}`)
      .set('Cookie', headersX.cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ isActive: false }),
    request(app.getHttpServer())
      .patch(`/api/admin/users/${xId}`)
      .set('Cookie', headersY.cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ isActive: false }),
  ])

  const statuses = [xRes.status, yRes.status].sort()
  assert.deepEqual(statuses, [200, 403])
  const forbidden = xRes.status === 403 ? xRes : yRes
  assert.equal(forbidden.body.code, 'FORBIDDEN')

  // Exactly one active administrator must remain.
  const active = await db.collection('adminusers').countDocuments({ isActive: true })
  assert.equal(active, 1)
})

test('expired temporary password cannot be used to log in', async () => {
  const { hash, salt } = hashPassword('temp-expired')
  const id = new Types.ObjectId()
  await db.collection('adminusers').insertOne({
    _id: id,
    email: 'expired@example.com',
    normalizedEmail: 'expired@example.com',
    displayName: 'Expired',
    passwordHash: encodeCredential(hash, salt),
    mustChangePassword: true,
    temporaryPasswordExpiresAt: new Date(Date.now() - 1000),
    isActive: true,
    createdBy: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  const expiredCsrf = await (async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/auth/csrf-token')
    return cookieValue(res.headers, 'csrf_token')
  })()
  const res = await request(app.getHttpServer())
    .post('/api/admin/auth/login')
    .set('Cookie', `csrf_token=${expiredCsrf}`)
    .set('X-CSRF-Token', expiredCsrf)
    .send({ email: 'expired@example.com', password: 'temp-expired' })

  assert.equal(res.status, 401)
  assert.equal(res.body.code, 'INVALID_CREDENTIALS')
  assert.equal(cookieValue(res.headers, 'admin_session'), null)
})

test('change-password rejects a password below the minimum length', async () => {
  const session = await spareCookie()
  const headers = await csrfHeaders(session)

  const response = await request(app.getHttpServer())
    .post('/api/admin/auth/change-password')
    .set('Cookie', headers.cookie)
    .set('X-CSRF-Token', headers['x-csrf-token'])
    .send({ currentPassword: ADMIN_PASS, newPassword: 'short' })

  assert.equal(response.status, 400)
  assert.equal(response.body.code, 'VALIDATION_ERROR')
})

test('PATCH rejects a non-boolean isActive value', async () => {
  const targetId = await insertAdmin('booluser@example.com', 'Bool User')

  const session = await spareCookie()
  const headers = await csrfHeaders(session)

  const response = await request(app.getHttpServer())
    .patch(`/api/admin/users/${targetId}`)
    .set('Cookie', headers.cookie)
    .set('X-CSRF-Token', headers['x-csrf-token'])
    .send({ isActive: 'false' })

  assert.equal(response.status, 400)
})

test('list includes inactive administrators so they can be managed', async () => {
  const inactiveId = await insertAdmin('inactive@example.com', 'Inactive User', ADMIN_PASS, false)

  const session = await spareCookie()
  const list = await request(app.getHttpServer())
    .get('/api/admin/users')
    .set('Cookie', `admin_session=${session}`)

  assert.equal(list.status, 200)
  assert.ok(list.body.items.some((u) => u.id === inactiveId && u.email === 'inactive@example.com'))
  assert.ok(list.body.items.some((u) => u.id === inactiveId && u.isActive === false))
})

test('category creation requires a CSRF token when authenticated by cookie', async () => {
  // Insert an admin and a session directly (avoids login rate limiting).
  const adminId = new Types.ObjectId()
  const token = 'category-session-token'
  await db.collection('adminusers').insertOne({
    _id: adminId,
    email: 'category@example.com',
    normalizedEmail: 'category@example.com',
    displayName: 'Category Admin',
    passwordHash: 'salt.hash',
    mustChangePassword: false,
    temporaryPasswordExpiresAt: null,
    isActive: true,
    createdBy: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  await db.collection('adminsessions').insertOne({
    _id: new Types.ObjectId(),
    adminUserId: adminId,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    revokedAt: null,
  })

  // Without a CSRF token the mutating request is rejected.
  const noToken = await request(app.getHttpServer())
    .post('/api/admin/categories')
    .set('Cookie', `admin_session=${token}`)
    .send({ name: 'No CSRF', slug: 'no-csrf' })
  assert.equal(noToken.status, 403)
  assert.equal(noToken.body.code, 'CSRF_REQUIRED')

  // With a matching CSRF token the request succeeds.
  const csrf = await (async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/auth/csrf-token')
    return cookieValue(res.headers, 'csrf_token')
  })()
  const created = await request(app.getHttpServer())
    .post('/api/admin/categories')
    .set('Cookie', `csrf_token=${csrf}; admin_session=${token}`)
    .set('X-CSRF-Token', csrf)
    .send({ name: 'With CSRF', slug: 'with-csrf' })
  assert.equal(created.status, 201)
  assert.equal(created.body.name, 'With CSRF')
})

