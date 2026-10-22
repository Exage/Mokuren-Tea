import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hashPassword, verifyPassword, normalizeEmail } from '../dist/auth/password.js'

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

test('normalizeEmail trims and lowercases without removing dots or plus suffixes', () => {
  assert.equal(normalizeEmail('  Admin@Example.COM  '), 'admin@example.com')
  assert.equal(normalizeEmail('User.Name+tag@Example.COM'), 'user.name+tag@example.com')
  assert.equal(normalizeEmail('UPPER@DOMAIN.COM'), 'upper@domain.com')
})

test('normalizeEmail rejects empty and non-string emails', () => {
  for (const email of ['', '   ', undefined, null, 123]) {
    assert.throws(() => normalizeEmail(email), /email is required|email must be a string/i)
  }
})
