import { Injectable } from '@nestjs/common'
import { ProductCatalogService } from '../products/product-catalog.service.js'
import { ReservationsService } from '../reservations/reservations.service.js'
import type { DashboardView } from './dashboard.types.js'

@Injectable()
export class DashboardService {
  constructor(
    private readonly productCatalogService: ProductCatalogService,
    private readonly reservationsService: ReservationsService
  ) {}

  async getDashboard(): Promise<DashboardView> {
    const stock = await this.productCatalogService.getStockOverview()
    const reservations = await this.reservationsService.getActiveOverview()
    return { reservations: reservations.counts, stock, recentReservations: reservations.recent }
  }
}
