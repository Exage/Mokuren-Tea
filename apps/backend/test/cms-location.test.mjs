import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateBlockContent } from '../dist/cms/cms-content-validation.js'

const contacts = {
  title: 'Visit us',
  address: 'Example address',
  phone: '+375291234567',
  email: 'tea@example.com',
  hours: 'Daily',
}

test('contact blocks accept existing content and valid map coordinates including zero', () => {
  assert.equal(validateBlockContent('contacts.content', contacts).success, true)
  const result = validateBlockContent('contacts.content', {
    ...contacts,
    location: { latitude: 0, longitude: 0 },
  })
  assert.equal(result.success, true)
  assert.deepEqual(result.data.location, { latitude: 0, longitude: 0 })
})

test('contact blocks reject incomplete and invalid map coordinates', () => {
  for (const location of [
    { latitude: 20 },
    { latitude: 86, longitude: 0 },
    { latitude: 0, longitude: 181 },
    { latitude: '53.9', longitude: 27.56 },
  ]) {
    assert.equal(validateBlockContent('contacts.content', { ...contacts, location }).success, false)
  }
})
