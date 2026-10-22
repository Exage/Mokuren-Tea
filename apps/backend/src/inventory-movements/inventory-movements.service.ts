import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectConnection } from '@nestjs/mongoose'
import { Types } from 'mongoose'
import type { ClientSession, Connection } from 'mongoose'
import { InventoryService } from '../inventory/inventory.service.js'
import { AuditService } from '../audit/audit.service.js'
import { IdempotencyService } from '../idempotency/idempotency.service.js'
import { InventoryMovementsRepository } from './inventory-movements.repository.js'
import type { InventoryMovementDocument } from './schemas/inventory-movement.schema.js'
import type {
  InventoryMovementType,
  StockDelta,
  StockSnapshot,
  CreateMovementResult,
  InventoryMovementList,
  InventoryMovementFilters,
} from './inventory-movements.types.js'

function requirePositiveGrams(grams: unknown, field: string): number {
  const n = grams as number
  if (!Number.isInteger(n) || n <= 0) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `${field} must be a positive integer`,
    })
  }
  return n
}

function requireNonNegativeInteger(value: unknown, field: string): number {
  const n = value as number
  if (!Number.isInteger(n) || n < 0) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `${field} must be a non-negative integer`,
    })
  }
  return n
}

interface MovementContext {
  before: StockSnapshot
  delta: StockDelta
  after: StockSnapshot
}

function buildContext(
  current: { physicalGrams: number; reservedGrams: number },
  delta: StockDelta
): MovementContext {
  return {
    before: { ...current },
    delta,
    after: {
      physicalGrams: current.physicalGrams + delta.physicalGrams,
      reservedGrams: current.reservedGrams + delta.reservedGrams,
    },
  }
}

@Injectable()
export class InventoryMovementsService {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly movementsRepository: InventoryMovementsRepository,
    private readonly auditService: AuditService,
    private readonly idempotencyService: IdempotencyService,
    @InjectConnection() private readonly connection: Connection
  ) {}

  // Records a movement directly with a pre-computed context. Used by
  // reservations where the before/after values must match the inventory
  // update that just happened. All within the caller's transaction.
  async recordMovementDirectly(
    productId: Types.ObjectId,
    type: InventoryMovementType,
    before: StockSnapshot,
    delta: StockDelta,
    after: StockSnapshot,
    reason: string | null,
    reservationId: Types.ObjectId | null,
    correctionOfId: Types.ObjectId | null,
    actorId: string | null,
    session: ClientSession
  ): Promise<InventoryMovementDocument> {
    const movement = await this.movementsRepository.createOne(
      {
        productId,
        type,
        before,
        delta,
        after,
        reason,
        reservationId,
        correctionOfId,
        actorId,
      },
      session
    )

    await this.auditService.record(
      {
        actorId,
        action: `inventory.${type}`,
        entityType: 'inventory',
        entityId: String(productId),
        changes: { delta, reservationId: reservationId ? String(reservationId) : null },
      },
      session
    )

    return movement
  }

  private async runInTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession()
    try {
      let result: T | undefined
      await session.withTransaction(async () => {
        result = await work(session)
      })
      return result as T
    } finally {
      await session.endSession()
    }
  }

  // Receipt: increases physicalGrams. Always valid (adds to stock).
  async receipt(
    productId: string,
    grams: number,
    actorId: string | null,
    reason: string | null,
    idempotencyKey: string | null
  ): Promise<CreateMovementResult> {
    const resolvedProductId = this.toObjectId(productId, 'productId')
    const resolvedGrams = requirePositiveGrams(grams, 'grams')

    let claimed = false
    let replay: { resultId: string | null; resultPayload: Record<string, unknown> | null } | null =
      null

    if (idempotencyKey) {
      const contentHash = await this.idempotencyService.computeHash({
        operation: 'inventory.receipt',
        productId,
        grams,
        reason,
      })
      const outcome = await this.idempotencyService.claim({
        key: idempotencyKey,
        operation: 'inventory.receipt',
        contentHash,
      })
      claimed = outcome.claimed
      replay = outcome.replay
    }

    if (!claimed && replay) {
      const payload = replay.resultPayload as CreateMovementResult | undefined
      if (payload) {
        return payload
      }
      throw new BadRequestException({
        code: 'IDEMPOTENCY_REPLAY_INVALID',
        message: 'Stored idempotency result is invalid',
      })
    }

    try {
      return await this.runInTransaction(async (session) => {
        const current = await this.inventoryService.getStockFor(resolvedProductId, session)

        const delta: StockDelta = { physicalGrams: resolvedGrams, reservedGrams: 0 }
        const context = buildContext(current, delta)

        if (context.after.physicalGrams < context.after.reservedGrams) {
          throw new ConflictException({
            code: 'INVALID_STOCK_OPERATION',
            message: 'Receipt would break the physical >= reserved invariant',
          })
        }

        const updated = await this.inventoryService.applyDelta(
          resolvedProductId,
          resolvedGrams,
          0,
          session
        )
        if (!updated) {
          throw new ConflictException({
            code: 'CONCURRENT_UPDATE',
            message: 'Stock changed concurrently, please retry',
          })
        }

        const movement = await this.movementsRepository.createOne(
          {
            productId: resolvedProductId,
            type: 'receipt',
            before: context.before,
            delta: context.delta,
            after: context.after,
            reason,
            reservationId: null,
            correctionOfId: null,
            actorId,
          },
          session
        )

        await this.auditService.record(
          {
            actorId,
            action: 'inventory.receipt',
            entityType: 'inventory',
            entityId: productId,
            changes: { grams: resolvedGrams, reason },
          },
          session
        )

        if (idempotencyKey && claimed) {
          await this.idempotencyService.complete(
            idempotencyKey,
            String(movement._id),
            {
              movementId: String(movement._id),
              stock: {
                physicalGrams: updated.physicalGrams,
                reservedGrams: updated.reservedGrams,
                availableGrams: updated.physicalGrams - updated.reservedGrams,
              },
            },
            session
          )
        }

        return {
          movementId: String(movement._id),
          stock: {
            physicalGrams: updated.physicalGrams,
            reservedGrams: updated.reservedGrams,
            availableGrams: updated.physicalGrams - updated.reservedGrams,
          },
        }
      })
    } catch (error) {
      if (idempotencyKey && claimed) {
        await this.idempotencyService.abandon(idempotencyKey)
      }
      throw error
    }
  }

  // Write-off: decreases physicalGrams from the unreserved portion only.
  // Cannot write off reserved grams.
  async writeOff(
    productId: string,
    grams: number,
    actorId: string | null,
    reason: string | null,
    idempotencyKey: string | null
  ): Promise<CreateMovementResult> {
    const resolvedProductId = this.toObjectId(productId, 'productId')
    const resolvedGrams = requirePositiveGrams(grams, 'grams')

    let claimed = false
    let replay: { resultId: string | null; resultPayload: Record<string, unknown> | null } | null =
      null

    if (idempotencyKey) {
      const contentHash = await this.idempotencyService.computeHash({
        operation: 'inventory.write-off',
        productId,
        grams,
        reason,
      })
      const outcome = await this.idempotencyService.claim({
        key: idempotencyKey,
        operation: 'inventory.write-off',
        contentHash,
      })
      claimed = outcome.claimed
      replay = outcome.replay
    }

    if (!claimed && replay) {
      const payload = replay.resultPayload as CreateMovementResult | undefined
      if (payload) {
        return payload
      }
      throw new BadRequestException({
        code: 'IDEMPOTENCY_REPLAY_INVALID',
        message: 'Stored idempotency result is invalid',
      })
    }

    try {
      return await this.runInTransaction(async (session) => {
        const current = await this.inventoryService.getStockFor(resolvedProductId, session)

        // Can only write off unreserved grams: physical - reserved >= grams
        if (current.physicalGrams - current.reservedGrams < resolvedGrams) {
          throw new ConflictException({
            code: 'INSUFFICIENT_UNRESERVED_STOCK',
            message: 'Not enough unreserved stock to write off',
          })
        }

        const delta: StockDelta = { physicalGrams: -resolvedGrams, reservedGrams: 0 }
        const context = buildContext(current, delta)

        const updated = await this.inventoryService.applyDelta(
          resolvedProductId,
          -resolvedGrams,
          0,
          session
        )
        if (!updated) {
          throw new ConflictException({
            code: 'CONCURRENT_UPDATE',
            message: 'Stock changed concurrently, please retry',
          })
        }

        const movement = await this.movementsRepository.createOne(
          {
            productId: resolvedProductId,
            type: 'write-off',
            before: context.before,
            delta: context.delta,
            after: context.after,
            reason,
            reservationId: null,
            correctionOfId: null,
            actorId,
          },
          session
        )

        await this.auditService.record(
          {
            actorId,
            action: 'inventory.write-off',
            entityType: 'inventory',
            entityId: productId,
            changes: { grams: resolvedGrams, reason },
          },
          session
        )

        if (idempotencyKey && claimed) {
          await this.idempotencyService.complete(
            idempotencyKey,
            String(movement._id),
            {
              movementId: String(movement._id),
              stock: {
                physicalGrams: updated.physicalGrams,
                reservedGrams: updated.reservedGrams,
                availableGrams: updated.physicalGrams - updated.reservedGrams,
              },
            },
            session
          )
        }

        return {
          movementId: String(movement._id),
          stock: {
            physicalGrams: updated.physicalGrams,
            reservedGrams: updated.reservedGrams,
            availableGrams: updated.physicalGrams - updated.reservedGrams,
          },
        }
      })
    } catch (error) {
      if (idempotencyKey && claimed) {
        await this.idempotencyService.abandon(idempotencyKey)
      }
      throw error
    }
  }

  // Adjustment: sets physicalGrams to an explicit target. The target must not
  // drop below the current reserved level, so reservations stay consistent.
  // Passes the target remaining, not a relative change.
  async adjust(
    productId: string,
    targetPhysicalGrams: number,
    actorId: string | null,
    reason: string | null,
    idempotencyKey: string | null
  ): Promise<CreateMovementResult> {
    const resolvedProductId = this.toObjectId(productId, 'productId')
    const resolvedTarget = requireNonNegativeInteger(targetPhysicalGrams, 'targetPhysicalGrams')

    let claimed = false
    let replay: { resultId: string | null; resultPayload: Record<string, unknown> | null } | null =
      null

    if (idempotencyKey) {
      const contentHash = await this.idempotencyService.computeHash({
        operation: 'inventory.adjust',
        productId,
        targetPhysicalGrams: resolvedTarget,
        reason,
      })
      const outcome = await this.idempotencyService.claim({
        key: idempotencyKey,
        operation: 'inventory.adjust',
        contentHash,
      })
      claimed = outcome.claimed
      replay = outcome.replay
    }

    if (!claimed && replay) {
      const payload = replay.resultPayload as CreateMovementResult | undefined
      if (payload) {
        return payload
      }
      throw new BadRequestException({
        code: 'IDEMPOTENCY_REPLAY_INVALID',
        message: 'Stored idempotency result is invalid',
      })
    }

    try {
      return await this.runInTransaction(async (session) => {
        const current = await this.inventoryService.getStockFor(resolvedProductId, session)

        // Target must not fall below reserved grams.
        if (resolvedTarget < current.reservedGrams) {
          throw new ConflictException({
            code: 'INSUFFICIENT_PHYSICAL_FOR_RESERVED',
            message: 'Target physical stock cannot be below reserved grams',
          })
        }

        const delta: StockDelta = {
          physicalGrams: resolvedTarget - current.physicalGrams,
          reservedGrams: 0,
        }
        const context = buildContext(current, delta)

        const updated = await this.inventoryService.applyDelta(
          resolvedProductId,
          delta.physicalGrams,
          0,
          session
        )
        if (!updated) {
          throw new ConflictException({
            code: 'CONCURRENT_UPDATE',
            message: 'Stock changed concurrently, please retry',
          })
        }

        const movement = await this.movementsRepository.createOne(
          {
            productId: resolvedProductId,
            type: 'adjustment',
            before: context.before,
            delta: context.delta,
            after: context.after,
            reason,
            reservationId: null,
            correctionOfId: null,
            actorId,
          },
          session
        )

        await this.auditService.record(
          {
            actorId,
            action: 'inventory.adjust',
            entityType: 'inventory',
            entityId: productId,
            changes: { targetPhysicalGrams: resolvedTarget, reason },
          },
          session
        )

        if (idempotencyKey && claimed) {
          await this.idempotencyService.complete(
            idempotencyKey,
            String(movement._id),
            {
              movementId: String(movement._id),
              stock: {
                physicalGrams: updated.physicalGrams,
                reservedGrams: updated.reservedGrams,
                availableGrams: updated.physicalGrams - updated.reservedGrams,
              },
            },
            session
          )
        }

        return {
          movementId: String(movement._id),
          stock: {
            physicalGrams: updated.physicalGrams,
            reservedGrams: updated.reservedGrams,
            availableGrams: updated.physicalGrams - updated.reservedGrams,
          },
        }
      })
    } catch (error) {
      if (idempotencyKey && claimed) {
        await this.idempotencyService.abandon(idempotencyKey)
      }
      throw error
    }
  }

  // Compensation: reverses a previous movement, accounting for any
  // compensations already applied against it. A repeat compensation only
  // reverses the remaining uncompensated amount.
  async compensate(
    movementId: string,
    actorId: string | null,
    reason: string | null,
    idempotencyKey: string | null
  ): Promise<CreateMovementResult> {
    const resolvedMovementId = this.toObjectId(movementId, 'movementId')

    let claimed = false
    let replay: { resultId: string | null; resultPayload: Record<string, unknown> | null } | null =
      null

    if (idempotencyKey) {
      const contentHash = await this.idempotencyService.computeHash({
        operation: 'inventory.compensate',
        movementId,
        reason,
      })
      const outcome = await this.idempotencyService.claim({
        key: idempotencyKey,
        operation: 'inventory.compensate',
        contentHash,
      })
      claimed = outcome.claimed
      replay = outcome.replay
    }

    if (!claimed && replay) {
      const payload = replay.resultPayload as CreateMovementResult | undefined
      if (payload) {
        return payload
      }
      throw new BadRequestException({
        code: 'IDEMPOTENCY_REPLAY_INVALID',
        message: 'Stored idempotency result is invalid',
      })
    }

    try {
      return await this.runInTransaction(async (session) => {
        const original = await this.movementsRepository.findById(movementId, session)
        if (!original) {
          throw new NotFoundException({ code: 'NOT_FOUND', message: 'Movement not found' })
        }

        // Sum deltas of compensations already applied to this movement.
        const previous = await this.movementsRepository.compensationDeltasFor(
          resolvedMovementId,
          session
        )

        const remainingPhysical = original.delta.physicalGrams + previous.physicalGrams
        const remainingReserved = original.reservationId
          ? 0
          : original.delta.reservedGrams + previous.reservedGrams

        if (original.reservationId && original.type !== 'complete') {
          throw new ConflictException({
            code: 'RESERVATION_MOVEMENT_NOT_COMPENSABLE',
            message:
              'Reservation reserve and release movements must be corrected through the reservation lifecycle',
          })
        }

        if (remainingPhysical === 0 && remainingReserved === 0) {
          throw new ConflictException({
            code: 'ALREADY_COMPENSATED',
            message: 'This movement is already fully compensated',
          })
        }

        // Compensation reverses the remaining uncompensated delta.
        const delta: StockDelta = {
          physicalGrams: -remainingPhysical,
          reservedGrams: -remainingReserved,
        }

        const productId = String(original.productId)
        const resolvedProductId = original.productId
        const current = await this.inventoryService.getStockFor(resolvedProductId, session)

        const context = buildContext(current, delta)

        const updated = await this.inventoryService.applyDelta(
          resolvedProductId,
          delta.physicalGrams,
          delta.reservedGrams,
          session
        )
        if (!updated) {
          throw new ConflictException({
            code: 'CONCURRENT_UPDATE',
            message: 'Stock changed concurrently, please retry',
          })
        }

        const movement = await this.movementsRepository.createOne(
          {
            productId: resolvedProductId,
            type: 'compensation',
            before: context.before,
            delta: context.delta,
            after: context.after,
            reason,
            reservationId: original.reservationId,
            correctionOfId: resolvedMovementId,
            actorId,
          },
          session
        )

        await this.auditService.record(
          {
            actorId,
            action: 'inventory.compensate',
            entityType: 'inventory',
            entityId: productId,
            changes: {
              originalMovementId: movementId,
              reversedPhysical: -delta.physicalGrams,
              reversedReserved: -delta.reservedGrams,
              reason,
            },
          },
          session
        )

        if (idempotencyKey && claimed) {
          await this.idempotencyService.complete(
            idempotencyKey,
            String(movement._id),
            {
              movementId: String(movement._id),
              stock: {
                physicalGrams: updated.physicalGrams,
                reservedGrams: updated.reservedGrams,
                availableGrams: updated.physicalGrams - updated.reservedGrams,
              },
            },
            session
          )
        }

        return {
          movementId: String(movement._id),
          stock: {
            physicalGrams: updated.physicalGrams,
            reservedGrams: updated.reservedGrams,
            availableGrams: updated.physicalGrams - updated.reservedGrams,
          },
        }
      })
    } catch (error) {
      if (idempotencyKey && claimed) {
        await this.idempotencyService.abandon(idempotencyKey)
      }
      throw error
    }
  }

  async getStock(productId: string): Promise<{
    physicalGrams: number
    reservedGrams: number
    availableGrams: number
  } | null> {
    const resolved = this.toObjectId(productId, 'productId')
    const current = await this.inventoryService.getStockFor(resolved)
    return {
      physicalGrams: current.physicalGrams,
      reservedGrams: current.reservedGrams,
      availableGrams: current.physicalGrams - current.reservedGrams,
    }
  }

  async listMovements(
    filters: Omit<InventoryMovementFilters, 'from' | 'to'> & { from?: string; to?: string }
  ): Promise<InventoryMovementList> {
    const parsedFilters: InventoryMovementFilters = {
      productId: filters.productId,
      type: filters.type,
      reservationId: filters.reservationId,
      correctionOfId: filters.correctionOfId,
      page: filters.page,
      limit: filters.limit,
    }

    if (filters.from) {
      parsedFilters.from = new Date(filters.from)
    }
    if (filters.to) {
      parsedFilters.to = new Date(filters.to)
    }

    return this.movementsRepository.list(parsedFilters)
  }

  private toObjectId(value: string, field: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `${field} must be a valid ObjectId`,
      })
    }
    return new Types.ObjectId(value)
  }
}
