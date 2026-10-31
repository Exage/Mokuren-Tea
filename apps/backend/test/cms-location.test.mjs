import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateBlockContent } from '../dist/cms/cms-content-validation.js'

test('contacts and store visit blocks require only editorial fields', () => {
  for (const key of ['contacts.content', 'home.visitStore']) {
    assert.deepEqual(validateBlockContent(key, { title: 'Visit us' }), {
      success: true,
      data: { title: 'Visit us' },
    })
  }
})

test('old CMS contact fields are discarded when saving or republishing legacy content', () => {
  for (const key of ['contacts.content', 'home.visitStore']) {
    assert.deepEqual(
      validateBlockContent(key, {
        title: 'Visit us',
        address: 'Old address',
        phone: 'Old phone',
        email: 'old@example.com',
        hours: 'Old hours',
        location: { latitude: 0, longitude: 0 },
      }),
      { success: true, data: { title: 'Visit us' } }
    )
    assert.equal(
      validateBlockContent(key, { title: 'Visit us', unexpected: 'value' }).success,
      false
    )
  }
})
