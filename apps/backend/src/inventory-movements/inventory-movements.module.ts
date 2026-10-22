import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { InventoryModule } from '../inventory/inventory.module.js'
import { AuditModule } from '../audit/audit.module.js'
import { IdempotencyModule } from '../idempotency/idempotency.module.js'
import { AdminInventoryMovementsController } from './admin-inventory-movements.controller.js'
import { InventoryMovementsService } from './inventory-movements.service.js'
import { InventoryMovementsRepository } from './inventory-movements.repository.js'
import { InventoryMovement, InventoryMovementSchema } from './schemas/inventory-movement.schema.js'

@Module({
  imports: [
    InventoryModule,
    AuditModule,
    IdempotencyModule,
    MongooseModule.forFeature([{ name: InventoryMovement.name, schema: InventoryMovementSchema }]),
  ],
  controllers: [AdminInventoryMovementsController],
  providers: [InventoryMovementsService, InventoryMovementsRepository],
  exports: [InventoryMovementsService],
})
export class InventoryMovementsModule {}
