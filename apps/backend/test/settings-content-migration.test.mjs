import assert from 'node:assert/strict'
import { test } from 'node:test'
import { settingsContentMigration } from '../dist/store-settings/settings-content-migration.js'

const empty = {
  name: 'Store',
  address: null,
  hours: null,
  phone: null,
  contacts: null,
  location: null,
}
const contacts = {
  address: 'Contact address',
  hours: 'Weekdays',
  phone: '+123',
  email: 'tea@example.com',
  location: { latitude: 0, longitude: 0 },
}

test('migration fills missing settings from published contacts, retaining zero coordinates', () => {
  const { patch, conflicts } = settingsContentMigration(empty, contacts, {
    address: 'Other address',
  })
  assert.deepEqual(patch, {
    address: 'Contact address',
    hours: 'Weekdays',
    phone: '+123',
    contacts: { email: 'tea@example.com' },
    location: { latitude: 0, longitude: 0 },
  })
  assert.deepEqual(conflicts, ['address'])
  assert.deepEqual(settingsContentMigration({ ...empty, ...patch }, contacts, null).patch, {})
})

test('migration preserves configured Settings and reports conflicts', () => {
  const settings = {
    ...empty,
    address: 'Configured address',
    phone: '+456',
    contacts: { Email: 'configured@example.com', Instagram: 'https://example.com' },
    location: { latitude: 10, longitude: 20 },
  }
  const { patch, conflicts } = settingsContentMigration(settings, contacts, null)
  assert.deepEqual(patch, { hours: 'Weekdays' })
  assert.deepEqual(conflicts, ['address', 'phone', 'email'])
})

test('migration can use visit details and never invents missing contacts', () => {
  assert.deepEqual(
    settingsContentMigration(empty, null, { address: 'Visit address', hours: 'Daily' }).patch,
    { address: 'Visit address', hours: 'Daily', hoursShort: 'Daily' }
  )
  assert.deepEqual(settingsContentMigration(empty, null, null), { patch: {}, conflicts: [] })
})
