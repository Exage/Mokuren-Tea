import type { StoreSettings, UpdateStoreSettingsInput } from '../types/store-settings'
import { catalogRequest } from './catalog-request'

export function getStoreSettings(signal?: AbortSignal) {
  return catalogRequest<StoreSettings | null>('store-settings', { signal })
}

export function updateStoreSettings(input: UpdateStoreSettingsInput) {
  return catalogRequest<StoreSettings>('store-settings', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}
