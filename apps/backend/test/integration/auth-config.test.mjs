import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import request from 'supertest'
import { AuthService } from '../../dist/auth/auth.service.js'
import { AdminUsersService } from '../../dist/auth/admin-users.service.js'
import { AuditService } from '../../dist/audit/audit.service.js'
import { hashSessionToken } from '../../dist/auth/admin-auth.guard.js'
import { startTestApp, stopTestApp } from './setup.mjs'

let app
let replSet
let db
let admin
const origin = 'https://admin.example.com'
const password = 'InitialPassword123'

function getCookie(response, name) {
  return response.headers['set-cookie'].find((cookie) => cookie.startsWith(`${name}=`)).split(';')[0]
}

before(async () => {
  const started = await startTestApp('mokuren_auth_config_test', {
    config: {
      SESSION_COOKIE_NAME: 'custom_session',
      CSRF_TOKEN_NAME: 'custom_csrf',
      SESSION_TTL_DAYS: '2',
      CORS_ORIGINS: origin,
    },
  })
  app = started.app
  replSet = started.replSet
  db = started.db
  admin = (await app.get(AdminUsersService).createUser(
    'configured@example.com', 'Configured', null, password,
  )).user
})

after(async () => {
  await stopTestApp(app, replSet)
})

test('credentialed preflight allows only exact configured origins and required headers', async () => {
  for (const candidate of [origin, 'https://admin.example.com.evil.example']) {
    const response = await request(app.getHttpServer())
      .options('/api/admin/auth/login')
      .set('Origin', candidate)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,x-csrf-token')
    assert.equal(response.status, 204)
    assert.equal(response.headers['access-control-allow-origin'], candidate === origin ? origin : undefined)
    if (candidate === origin) {
      assert.equal(response.headers['access-control-allow-credentials'], 'true')
      assert.match(response.headers['access-control-allow-headers'], /X-CSRF-Token/i)
    }
  }
})

test('custom cookies work through login, protected mutations, password change, and logout', async () => {
  const csrfResponse = await request(app.getHttpServer()).get('/api/admin/auth/csrf-token')
  assert.equal(csrfResponse.status, 204)
  const csrfCookie = getCookie(csrfResponse, 'custom_csrf')
  const csrfToken = csrfCookie.split('=')[1]
  const login = await request(app.getHttpServer())
    .post('/api/ADMIN/AUTH/LOGIN')
    .set('Origin', origin)
    .set('Cookie', csrfCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({ login: admin.login, password })
  assert.equal(login.status, 200)
  assert.equal(login.headers['access-control-allow-origin'], origin)
  const sessionCookie = getCookie(login, 'custom_session')
  const token = sessionCookie.split('=')[1]
  const session = await db.collection('adminsessions').findOne({ tokenHash: hashSessionToken(token) })
  assert.ok(Math.abs(session.expiresAt.getTime() - Date.now() - 2 * 86400000) < 10000)
  assert.match(login.headers['set-cookie'].join(';'), /Max-Age=172800/)

  const denied = await request(app.getHttpServer())
    .post('/api/admin/categories')
    .set('Cookie', sessionCookie)
    .send({ name: 'Configured', slug: 'configured' })
  assert.equal(denied.status, 403)
  const created = await request(app.getHttpServer())
    .post('/api/admin/categories')
    .set('Cookie', `${sessionCookie}; ${csrfCookie}`)
    .set('X-CSRF-Token', csrfToken)
    .send({ name: 'Configured', slug: 'configured' })
  assert.equal(created.status, 201)

  const changed = await request(app.getHttpServer())
    .post('/api/admin/auth/change-password')
    .set('Cookie', `${sessionCookie}; ${csrfCookie}`)
    .set('X-CSRF-Token', csrfToken)
    .send({ currentPassword: password, newPassword: 'ChangedPassword123' })
  assert.equal(changed.status, 200)
  const audit = await db.collection('auditlogs').findOne({
    action: 'admin-user.password-changed', entityId: admin.id,
  })
  assert.ok(audit)
  assert.equal(audit.actorId, admin.id)
  assert.deepEqual(audit.changes, { mustChangePassword: false })
  assert.ok(!JSON.stringify(audit).includes('ChangedPassword123'))
  assert.ok(!JSON.stringify(audit).includes(token))

  const logout = await request(app.getHttpServer())
    .post('/api/admin/auth/logout')
    .set('Cookie', `${getCookie(changed, 'custom_session')}; ${csrfCookie}`)
    .set('X-CSRF-Token', csrfToken)
  assert.equal(logout.status, 200)
  assert.equal(getCookie(logout, 'custom_session'), 'custom_session=')
})

test('audit failures roll back password changes and logout revocations', async (t) => {
  const auth = app.get(AuthService)
  const login = await auth.login(admin.login, 'ChangedPassword123')
  const audit = t.mock.method(app.get(AuditService), 'record', async () => {
    throw new Error('Audit unavailable')
  })
  await assert.rejects(
    auth.changePassword(admin.id, 'ChangedPassword123', 'MustNotPersist123'),
    /Audit unavailable/,
  )
  await assert.rejects(auth.logout(admin.id, hashSessionToken(login.token)), /Audit unavailable/)
  audit.mock.restore()
  const session = await db.collection('adminsessions').findOne({ tokenHash: hashSessionToken(login.token) })
  assert.equal(session.revokedAt, null)
  await auth.login(admin.login, 'ChangedPassword123')
  await assert.rejects(auth.login(admin.login, 'MustNotPersist123'), /Invalid login or password/)
})
