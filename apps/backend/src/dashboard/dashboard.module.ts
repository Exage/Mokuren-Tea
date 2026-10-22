import { Module } from '@nestjs/common'
import { ProductsModule } from '../products/products.module.js'
import { ReservationsModule } from '../reservations/reservations.module.js'
import { DashboardService } from './dashboard.service.js'
import { AdminDashboardController } from './admin-dashboard.controller.js'

@Module({
  imports: [ProductsModule, ReservationsModule],
  controllers: [AdminDashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
