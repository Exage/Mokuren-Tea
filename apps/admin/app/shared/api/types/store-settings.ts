export interface StoreSettings {
  id: string
  name: string
  tagline: string | null
  address: string | null
  hours: string | null
  hoursShort: string | null
  location: { latitude: number; longitude: number } | null
  phone: string | null
  contacts: Record<string, unknown> | null
  updatedAt: string
}

export type UpdateStoreSettingsInput = Partial<
  Pick<
    StoreSettings,
    'name' | 'tagline' | 'address' | 'hours' | 'hoursShort' | 'phone' | 'contacts' | 'location'
  >
>
