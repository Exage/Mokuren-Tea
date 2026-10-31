import type { StoreSettingsView, UpdateStoreSettingsInput } from './store-settings.types.js'

export function settingsContentMigration(
  settings: StoreSettingsView,
  contacts: Record<string, unknown> | null,
  visit: Record<string, unknown> | null
): { patch: UpdateStoreSettingsInput; conflicts: string[] } {
  const patch: UpdateStoreSettingsInput = {}
  const conflicts: string[] = []
  for (const key of ['address', 'hours', 'phone'] as const) {
    const primary = contacts?.[key]
    const secondary = key === 'phone' ? null : visit?.[key]
    const value =
      typeof primary === 'string' && primary.trim()
        ? primary.trim()
        : typeof secondary === 'string' && secondary.trim()
          ? secondary.trim()
          : null
    if (value && !settings[key]) {
      patch[key] = value
    }
    if (
      (settings[key] && value && settings[key] !== value) ||
      (primary && secondary && primary !== secondary)
    ) {
      conflicts.push(key)
    }
  }
  const compactHours = visit?.hours
  if (!settings.hoursShort && typeof compactHours === 'string' && compactHours.trim()) {
    patch.hoursShort = compactHours.trim()
  }
  const email = contacts?.email
  if (typeof email === 'string' && email.trim()) {
    const existing = Object.entries(settings.contacts || {}).find(
      ([key]) => key.toLowerCase() === 'email'
    )
    if (!existing) {
      patch.contacts = { ...settings.contacts, email: email.trim() }
    } else if (existing[1] !== email.trim()) {
      conflicts.push('email')
    }
  }
  const location = contacts?.location as { latitude?: unknown; longitude?: unknown } | undefined
  if (
    !settings.location &&
    location &&
    typeof location.latitude === 'number' &&
    Number.isFinite(location.latitude) &&
    Math.abs(location.latitude) <= 85.0511 &&
    typeof location.longitude === 'number' &&
    Number.isFinite(location.longitude) &&
    Math.abs(location.longitude) <= 180
  ) {
    patch.location = { latitude: location.latitude, longitude: location.longitude }
  }
  return { patch, conflicts }
}
