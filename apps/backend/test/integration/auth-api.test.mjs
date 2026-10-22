import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { Types } from 'mongoose'
import request from 'supertest'
import { AdminUserRepository } from '../../dist/auth/admin-user.repository.js'
import { hashPassword, encodeCredential } from '../../dist/auth/password.js'
import { hashSessionToken } from '../../dist/auth/admin-auth.guard.js'
import { startTestApp, stopTestApp } from './setup.mjs'

let app
let replSet
let db
let userRepository

const ADMIN_EMAIL = 'admin@example.com'
const ADMIN_PASSWORD = 'Password123'

function setCookieHeader(jar, name, value) {
  jar.push(`${name}=${value}`)
}

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

// Fetches a CSRF token cookie so state-changing requests can present the
// matching X-CSRF-Token header. Login now always requires a CSRF token.
async function fetchCsrfToken() {
  const res = await request(app.getHttpServer()).get('/api/admin/auth/csrf-token')
  const token = cookieValue(res.headers, 'csrf_token')
  assert.ok(typeof token === 'string' && token.length > 0, 'csrf_token cookie was issued')
  return token
}

function assertCookieIsHttpOnly(headers, name) {
  const raw = headers['set-cookie']
  const list = Array.isArray(raw) ? raw : [raw]
  const entry = list.find((e) => e.startsWith(`${name}=`))
  assert.ok(entry, `${name} cookie was set`)
  assert.ok(entry.includes('HttpOnly'), `${name} cookie is HttpOnly`)
  assert.ok(entry.includes('Path=/'), `${name} cookie has Path=/`)
  assert.ok(entry.includes('SameSite=Lax'), `${name} cookie has SameSite=Lax`)
}

before(async () => {
  const started = await startTestApp('mokuren_auth_api_test')
  app = started.app
  replSet = started.replSet
  db = started.db
  userRepository = app.get(AdminUserRepository)

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
    null,
  )
})

after(async () => {
  await stopTestApp(app, replSet)
})

async function loginJar(email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  const csrfToken = await fetchCsrfToken()
  const jar = []
  const cookie = `csrf_token=${csrfToken}${jar.length > 0 ? '; ' + jar.join('; ') : ''}`
  const response = await request(app.getHttpServer())
    .post('/api/admin/auth/login')
    .set('Cookie', cookie)
    .set('X-CSRF-Token', csrfToken)
    .send({ email, password })
  setCookieHeader(jar, 'admin_session', cookieValue(response.headers, 'admin_session') || '')
  return { response, jar }
}

// Resets the shared administrator's password to ADMIN_PASSWORD so tests that
// run after the password-changing test are not affected by shared state.
async function resetAdminPassword() {
  const { hash, salt } = hashPassword(ADMIN_PASSWORD)
  const admin = await userRepository.findByNormalizedEmail(ADMIN_EMAIL)
  admin.passwordHash = encodeCredential(hash, salt)
  await userRepository.save(admin, null)
}

test('login rejects missing credentials with 400', async () => {
  const csrfToken = await fetchCsrfToken()
  const response = await request(app.getHttpServer())
    .post('/api/admin/auth/login')
    .set('Cookie', `csrf_token=${csrfToken}`)
    .set('X-CSRF-Token', csrfToken)
    .send({})
  assert.equal(response.status, 400)
})

test('login requires CSRF for every route casing, including form submissions', async () => {
  for (const path of ['/api/admin/auth/login', '/api/ADMIN/AUTH/LOGIN', '/API/Admin/Auth/Login/']) {
    const response = await request(app.getHttpServer())
      .post(path)
      .set('Origin', 'https://untrusted.example')
      .type('form')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    assert.equal(response.status, 403, path)
    assert.equal(response.body.code, 'CSRF_REQUIRED')
    assert.equal(cookieValue(response.headers, 'admin_session'), null)
  }
})

test('an empty duplicate session cookie cannot bypass CSRF', async () => {
  const { response } = await loginJar()
  const token = cookieValue(response.headers, 'admin_session')
  const logout = await request(app.getHttpServer())
    .post('/api/admin/auth/logout')
    .set('Cookie', `admin_session=${token}; admin_session=`)
  assert.equal(logout.status, 403)
  assert.equal(logout.body.code, 'CSRF_REQUIRED')
  const session = await db.collection('adminsessions').findOne({ tokenHash: hashSessionToken(token) })
  assert.equal(session.revokedAt, null)
})

test('login rejects wrong credentials with a generic 401 and no session cookie', async () => {
  const csrfToken = await fetchCsrfToken()
  const response = await request(app.getHttpServer())
    .post('/api/admin/auth/login')
    .set('Cookie', `csrf_token=${csrfToken}`)
    .set('X-CSRF-Token', csrfToken)
    .send({ email: ADMIN_EMAIL, password: 'wrong-password' })
  assert.equal(response.status, 401)
  assert.equal(response.body.code, 'INVALID_CREDENTIALS')
  assert.equal(cookieValue(response.headers, 'admin_session'), null)
})

test('login rejects an unknown email with the same generic 401', async () => {
  const csrfToken = await fetchCsrfToken()
  const response = await request(app.getHttpServer())
    .post('/api/admin/auth/login')
    .set('Cookie', `csrf_token=${csrfToken}`)
    .set('X-CSRF-Token', csrfToken)
    .send({ email: 'nobody@example.com', password: ADMIN_PASSWORD })
  assert.equal(response.status, 401)
  assert.equal(response.body.code, 'INVALID_CREDENTIALS')
})

test('login succeeds, sets an HttpOnly session cookie, and returns safe user data', async () => {
  const { response, jar } = await loginJar()

  assert.equal(response.status, 200)
  assert.equal(response.body.user.email, ADMIN_EMAIL)
  assert.equal(response.body.user.displayName, 'Administrator')
  assert.equal(response.body.user.mustChangePassword, false)
  assert.equal(response.body.mustChangePassword, false)
  assert.ok(typeof response.body.user.id === 'string' && response.body.user.id.length > 0)
  assert.ok(!response.body.user.passwordHash)
  assert.ok(typeof cookieValue(response.headers, 'admin_session') === 'string')
  assertCookieIsHttpOnly(response.headers, 'admin_session')

  // The cookie is accepted on a protected endpoint.
  const me = await request(app.getHttpServer())
    .get('/api/admin/auth/me')
    .set('Cookie', jar.join('; '))
  assert.equal(me.status, 200)
  assert.equal(me.body.email, ADMIN_EMAIL)
})

test('login normalizes email casing and whitespace', async () => {
  const csrfToken = await fetchCsrfToken()
  const response = await request(app.getHttpServer())
    .post('/api/admin/auth/login')
    .set('Cookie', `csrf_token=${csrfToken}`)
    .set('X-CSRF-Token', csrfToken)
    .send({ email: '  ADMIN@Example.COM  ', password: ADMIN_PASSWORD })
  assert.equal(response.status, 200)
  assert.equal(response.body.user.email, ADMIN_EMAIL)
})

test('me rejects requests without a session', async () => {
  const response = await request(app.getHttpServer()).get('/api/admin/auth/me')
  assert.equal(response.status, 401)
  assert.equal(response.body.code, 'UNAUTHORIZED')
})

test('logout revokes the session and clears the cookie with matching options', async () => {
  const { response } = await loginJar()
  const token = cookieValue(response.headers, 'admin_session')
  assert.ok(token)
  const csrfToken = await fetchCsrfToken()

  const before = await db
    .collection('adminsessions')
    .findOne({ tokenHash: hashSessionToken(token) })
  assert.ok(before && !before.revokedAt)

  const logout = await request(app.getHttpServer())
    .post('/api/admin/auth/logout')
    .set('Cookie', `csrf_token=${csrfToken}; admin_session=${token}`)
    .set('X-CSRF-Token', csrfToken)
  assert.equal(logout.status, 200)

  const after = await db
    .collection('adminsessions')
    .findOne({ tokenHash: hashSessionToken(token) })
  assert.ok(after && after.revokedAt)
  const audit = await db.collection('auditlogs').findOne({
    action: 'admin-user.logged-out',
    entityId: response.body.user.id,
  })
  assert.ok(audit)
  assert.equal(audit.actorId, response.body.user.id)
  assert.ok(!JSON.stringify(audit).includes(token))
  assert.ok(!JSON.stringify(audit).includes(hashSessionToken(token)))

  const cleared = logout.headers['set-cookie']
  assert.ok(cleared)
  const list = Array.isArray(cleared) ? cleared : [cleared]
  assert.ok(
    list.some(
      (e) =>
        e.startsWith('admin_session=') &&
        e.includes('HttpOnly') &&
        e.includes('Expires=Thu, 01 Jan 1970'),
    ),
    'logout clears the admin_session cookie with matching options',
  )
})

test('me rejects a revoked session', async () => {
  const { response } = await loginJar()
  const token = cookieValue(response.headers, 'admin_session')
  await db.collection('adminsessions').updateOne(
    { tokenHash: hashSessionToken(token) },
    { $set: { revokedAt: new Date() } },
  )

  const me = await request(app.getHttpServer())
    .get('/api/admin/auth/me')
    .set('Cookie', `admin_session=${token}`)
  assert.equal(me.status, 401)
})

test('change-password rejects a wrong current password', async () => {
  const { jar } = await loginJar()
  const token = cookieValue({ headers: { 'set-cookie': jar.join('; ') } }, 'admin_session') || jar[0].split('=')[1]
  const csrfToken = await fetchCsrfToken()
  const response = await request(app.getHttpServer())
    .post('/api/admin/auth/change-password')
    .set('Cookie', `csrf_token=${csrfToken}; admin_session=${token}`)
    .set('X-CSRF-Token', csrfToken)
    .send({ currentPassword: 'wrong-current', newPassword: 'NewPassword123' })
  assert.equal(response.status, 401)
  assert.equal(response.body.code, 'INVALID_CREDENTIALS')
})

test('change-password rotates the session and clears mustChangePassword', async () => {
  const { jar } = await loginJar()
  const token = jar[0].split('=')[1]
  const csrfToken = await fetchCsrfToken()
  const response = await request(app.getHttpServer())
    .post('/api/admin/auth/change-password')
    .set('Cookie', `csrf_token=${csrfToken}; admin_session=${token}`)
    .set('X-CSRF-Token', csrfToken)
    .send({ currentPassword: ADMIN_PASSWORD, newPassword: 'NewPassword123' })
  assert.equal(response.status, 200)
  assert.equal(response.body.user.mustChangePassword, false)
  assert.ok(cookieValue(response.headers, 'admin_session'))

  // The old session cookie no longer works; the new one does.
  const oldToken = token
  const meOld = await request(app.getHttpServer())
    .get('/api/admin/auth/me')
    .set('Cookie', `admin_session=${oldToken}`)
  assert.equal(meOld.status, 401)

  const newToken = cookieValue(response.headers, 'admin_session')
  const meNew = await request(app.getHttpServer())
    .get('/api/admin/auth/me')
    .set('Cookie', `admin_session=${newToken}`)
  assert.equal(meNew.status, 200)
})

test('change-password with the new password then works for login', async () => {
  await resetAdminPassword()
  const { jar } = await loginJar()
  const token = jar[0].split('=')[1]
  const csrfToken = await fetchCsrfToken()
  await request(app.getHttpServer())
    .post('/api/admin/auth/change-password')
    .set('Cookie', `csrf_token=${csrfToken}; admin_session=${token}`)
    .set('X-CSRF-Token', csrfToken)
    .send({ currentPassword: ADMIN_PASSWORD, newPassword: 'NewPassword123' })

  const finalCsrfToken = await fetchCsrfToken()
  const response = await request(app.getHttpServer())
    .post('/api/admin/auth/login')
    .set('Cookie', `csrf_token=${finalCsrfToken}`)
    .set('X-CSRF-Token', finalCsrfToken)
    .send({ email: ADMIN_EMAIL, password: 'NewPassword123' })
  assert.equal(response.status, 200)

  // Restore the shared administrator's password for the tests that follow.
  await resetAdminPassword()
})

test('csrf-token endpoint issues a non-HttpOnly cookie', async () => {
  const response = await request(app.getHttpServer()).get('/api/admin/auth/csrf-token')
  assert.equal(response.status, 204)
  const token = cookieValue(response.headers, 'csrf_token')
  assert.ok(typeof token === 'string' && token.length > 0)

  const raw = response.headers['set-cookie']
  const list = Array.isArray(raw) ? raw : [raw]
  assert.ok(list.some((e) => e.startsWith('csrf_token=') && !e.includes('HttpOnly')))
})

test('csrf blocks login when a csrf cookie exists but no token header is sent', async () => {
  await resetAdminPassword()
  const tokenRes = await request(app.getHttpServer()).get('/api/admin/auth/csrf-token')
  const csrfToken = cookieValue(tokenRes.headers, 'csrf_token')
  assert.ok(csrfToken)

  const response = await request(app.getHttpServer())
    .post('/api/admin/auth/login')
    .set('Cookie', `csrf_token=${csrfToken}`)
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })

  assert.equal(response.status, 403)
  assert.equal(response.body.code, 'CSRF_REQUIRED')
})

test('csrf allows login when the token header matches the cookie', async () => {
  await resetAdminPassword()
  const tokenRes = await request(app.getHttpServer()).get('/api/admin/auth/csrf-token')
  const csrfToken = cookieValue(tokenRes.headers, 'csrf_token')
  assert.ok(csrfToken)

  const response = await request(app.getHttpServer())
    .post('/api/admin/auth/login')
    .set('Cookie', `csrf_token=${csrfToken}`)
    .set('X-CSRF-Token', csrfToken)
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })

  assert.equal(response.status, 200)
  assert.equal(response.body.user.email, ADMIN_EMAIL)
  assert.ok(cookieValue(response.headers, 'admin_session'))
})

test('csrf blocks logout when a csrf cookie exists but no token header is sent', async () => {
  await resetAdminPassword()
  const { jar } = await loginJar()
  const tokenRes = await request(app.getHttpServer()).get('/api/admin/auth/csrf-token')
  setCookieHeader(jar, 'csrf_token', cookieValue(tokenRes.headers, 'csrf_token'))

  const response = await request(app.getHttpServer())
    .post('/api/admin/auth/logout')
    .set('Cookie', jar.join('; '))

  assert.equal(response.status, 403)
  assert.equal(response.body.code, 'CSRF_REQUIRED')

  // The session was not revoked: the request never reached logout.
  const me = await request(app.getHttpServer())
    .get('/api/admin/auth/me')
    .set('Cookie', jar.join('; '))
  assert.equal(me.status, 200)
})

test('csrf allows logout when the token header matches', async () => {
  await resetAdminPassword()
  const { jar } = await loginJar()
  const tokenRes = await request(app.getHttpServer()).get('/api/admin/auth/csrf-token')
  const csrfToken = cookieValue(tokenRes.headers, 'csrf_token')
  setCookieHeader(jar, 'csrf_token', csrfToken)

  const response = await request(app.getHttpServer())
    .post('/api/admin/auth/logout')
    .set('Cookie', jar.join('; '))
    .set('X-CSRF-Token', csrfToken)

  assert.equal(response.status, 200)
})

test('rate limiting returns 429 after exceeding the login threshold', async () => {
  const { RateLimitGuard } = await import('../../dist/auth/rate-limit.guard.js')

  // A minimal config that yields a very low limit so the guard trips quickly.
  const config = {
    get: (key) => {
      if (key === 'RATE_LIMIT_MAX') {
        return '2'
      }
      if (key === 'RATE_LIMIT_WINDOW_MS') {
        return '60000'
      }
      return undefined
    },
  }

  const guard = new RateLimitGuard(config)
  const mockRequest = {
    ip: '127.0.0.1',
    method: 'POST',
    headers: {},
    url: '/api/admin/auth/login',
  }
  const mockContext = {
    switchToHttp: () => ({ getRequest: () => mockRequest }),
  }

  // The first two requests are allowed.
  for (let i = 0; i < 2; i++) {
    assert.equal(guard.canActivate(mockContext), true)
  }

  // The third request is rate limited.
  let threw = false
  try {
    guard.canActivate(mockContext)
  } catch (error) {
    threw = true
    assert.equal(error.status, 429)
    assert.equal(error.getResponse().code, 'RATE_LIMITED')
  }
  assert.equal(threw, true, 'expected rate limiting to kick in')
})
