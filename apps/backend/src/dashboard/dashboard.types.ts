import type { ProductStockOverview } from '../products/products.types.js'
import type { ActiveReservationsOverview } from '../reservations/reservations.types.js'

export interface DashboardView {
  reservations: ActiveReservationsOverview['counts']
  stock: ProductStockOverview
  recentReservations: ActiveReservationsOverview['recent']
}
