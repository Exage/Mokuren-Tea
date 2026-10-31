import type { StoreSettings, UpdateStoreSettingsInput } from '@/app/shared/api/types/store-settings'

export type SettingsForm = Record<
  'name' | 'tagline' | 'address' | 'hours' | 'hoursShort' | 'phone' | 'latitude' | 'longitude',
  string
> & {
  contacts: { id: string; key: string; value: string }[]
}

export function settingsForm(settings: StoreSettings): SettingsForm {
  return {
    name: settings.name,
    tagline: settings.tagline || '',
    address: settings.address || '',
    hours: settings.hours || '',
    hoursShort: settings.hoursShort || '',
    latitude: settings.location ? String(settings.location.latitude) : '',
    longitude: settings.location ? String(settings.location.longitude) : '',
    phone: settings.phone || '',
    contacts: Object.entries(settings.contacts || {})
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([key, value], index) => ({ id: String(index), key, value })),
  }
}

export function settingsPatch(form: SettingsForm, saved: StoreSettings): UpdateStoreSettingsInput {
  if (!form.name.trim()) {
    throw new Error('Enter a store name.')
  }
  const patch: UpdateStoreSettingsInput = {}
  for (const key of ['name', 'tagline', 'address', 'hours', 'hoursShort', 'phone'] as const) {
    const value = (form[key] ?? saved[key] ?? '').trim() || null
    if (value !== (saved[key] || null)) {
      Object.assign(patch, { [key]: value })
    }
  }
  const latitude = form.latitude.trim()
  const longitude = form.longitude.trim()
  if (Boolean(latitude) !== Boolean(longitude)) {
    throw new Error('Enter both map coordinates, or clear both.')
  }
  const location =
    latitude && longitude ? { latitude: Number(latitude), longitude: Number(longitude) } : null
  if (
    location &&
    (!Number.isFinite(location.latitude) ||
      Math.abs(location.latitude) > 85.0511 ||
      !Number.isFinite(location.longitude) ||
      Math.abs(location.longitude) > 180)
  ) {
    throw new Error('Enter valid map coordinates.')
  }
  if (JSON.stringify(location) !== JSON.stringify(saved.location || null)) {
    patch.location = location
  }
  // Preserve structured contact values that this text editor cannot edit.
  const entries = Object.entries(saved.contacts || {}).filter(
    ([, value]) => typeof value !== 'string'
  )
  const keys = new Set(entries.map(([key]) => key))
  for (const contact of form.contacts) {
    const key = contact.key.trim()
    const value = contact.value.trim()
    if (!key && !value) {
      continue
    }
    if (!key || !value) {
      throw new Error('Enter a label and value for each contact, or remove the empty contact.')
    }
    if (keys.has(key)) {
      throw new Error(`The contact label “${key}” is already in use. Use a unique label.`)
    }
    keys.add(key)
    entries.push([key, value])
  }
  const contacts = entries.length ? Object.fromEntries(entries) : null
  // Object key order has no meaning in the contact dictionary.
  const previous = saved.contacts || {}
  if (
    entries.length !== Object.keys(previous).length ||
    entries.some(([key, value]) => JSON.stringify(value) !== JSON.stringify(previous[key]))
  ) {
    patch.contacts = contacts
  }
  return patch
}
