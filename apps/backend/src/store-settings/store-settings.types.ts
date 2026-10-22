export interface StoreSettingsView {
  id: string
  name: string
  tagline: string | null
  address: string | null
  hours: string | null
  phone: string | null
  contacts: Record<string, unknown> | null
  updatedAt: string
}

export interface UpdateStoreSettingsInput {
  name?: string | null
  tagline?: string | null
  address?: string | null
  hours?: string | null
  phone?: string | null
  contacts?: Record<string, unknown> | null
}
