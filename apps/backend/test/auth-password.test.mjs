import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hashPassword, verifyPassword, normalizeLogin } from '../dist/auth/password.js'

test('hashPassword produces a salted argon2id hash that verifyPassword accepts', () => {
  const stored = hashPassword('Password123')

  assert.ok(typeof stored.hash === 'string' && stored.hash.length > 0)
  assert.ok(typeof stored.salt === 'string' && stored.salt.length > 0)
  assert.equal(verifyPassword('Password123', stored), true)
})

test('verifyPassword rejects a wrong password for the same salt', () => {
  const stored = hashPassword('Password123')

  assert.equal(verifyPassword('wrong-password', stored), false)
})

test('verifyPassword rejects a tampered hash', () => {
  const stored = hashPassword('Password123')

  assert.equal(verifyPassword('Password123', { ...stored, hash: 'deadbeef' }), false)
})

test('hashPassword generates a fresh salt for each password hash', () => {
  const first = hashPassword('Password123')
  const second = hashPassword('Password123')
  assert.notEqual(first.salt, second.salt, 'each hash gets a fresh random salt')
  assert.equal(verifyPassword('Password123', first), true)
})

test('hashPassword rejects empty and non-string passwords', () => {
  for (const password of ['', undefined, null, 123]) {
    assert.throws(() => hashPassword(password), /password is required/i)
  }
})

test('verifyPassword returns false for empty and non-string passwords', () => {
  const stored = hashPassword('Password123')

  for (const password of ['', undefined, null, 123]) {
    assert.equal(verifyPassword(password, stored), false)
  }
})

test('normalizeLogin accepts usernames and preserves existing email-based identifiers', () => {
  assert.equal(normalizeLogin('  Store.Admin_01  '), 'store.admin_01')
  assert.equal(normalizeLogin('  Admin@Example.COM  '), 'admin@example.com')
  assert.equal(normalizeLogin('User.Name+tag@Example.COM'), 'user.name+tag@example.com')
  assert.equal(normalizeLogin('UPPER@DOMAIN.COM'), 'upper@domain.com')
})

test('normalizeLogin rejects empty and non-string logins', () => {
  for (const login of ['', '   ', undefined, null, 123]) {
    assert.throws(() => normalizeLogin(login), /login is required|login must be a string/i)
  }
})

test('normalizeLogin rejects identifiers longer than the stored login limit', () => {
  assert.throws(() => normalizeLogin('a'.repeat(301)), /must not exceed 300/)
})
