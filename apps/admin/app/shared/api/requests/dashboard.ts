import type { Dashboard } from '../types/reservations'
import { catalogRequest } from './catalog-request'

export function getDashboard(signal?: AbortSignal) {
  return catalogRequest<Dashboard>('dashboard', { signal })
}
