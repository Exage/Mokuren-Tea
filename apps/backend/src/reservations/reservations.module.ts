import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { ProductsModule } from '../products/products.module.js'
import { AuthModule } from '../auth/auth.module.js'
import { InventoryModule } from '../inventory/inventory.module.js'
import { InventoryMovementsModule } from '../inventory-movements/inventory-movements.module.js'
import { AuditModule } from '../audit/audit.module.js'
import { IdempotencyModule } from '../idempotency/idempotency.module.js'
import { ReservationsService } from './reservations.service.js'
import { ReservationsRepository } from './reservations.repository.js'
import { ReservationEventsRepository } from './reservation-events.repository.js'
import { PublicReservationsController } from './public-reservations.controller.js'
import { AdminReservationsController } from './admin-reservations.controller.js'
import { Reservation, ReservationSchema } from './schemas/reservation.schema.js'
import { ReservationEvent, ReservationEventSchema } from './schemas/reservation-event.schema.js'
import { Counter, CounterSchema } from './schemas/counter.schema.js'

@Module({
  imports: [
    ProductsModule,
    AuthModule,
    InventoryModule,
    InventoryMovementsModule,
    AuditModule,
    IdempotencyModule,
    MongooseModule.forFeature([
      { name: Reservation.name, schema: ReservationSchema },
      { name: ReservationEvent.name, schema: ReservationEventSchema },
      { name: Counter.name, schema: CounterSchema },
    ]),
  ],
  controllers: [PublicReservationsController, AdminReservationsController],
  providers: [ReservationsService, ReservationsRepository, ReservationEventsRepository],
  exports: [ReservationsService],
})
export class ReservationsModule {}
