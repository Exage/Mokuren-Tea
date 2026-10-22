import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import type { ClientSession } from 'mongoose'
import { InventoryMovement } from './schemas/inventory-movement.schema.js'
import type { InventoryMovementDocument } from './schemas/inventory-movement.schema.js'
import type {
  InventoryMovementFilters,
  InventoryMovementList,
  StockDelta,
  StockSnapshot,
} from './inventory-movements.types.js'

function toObjectId(value: string, field: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${field} must be a valid ObjectId`)
  }

  return new Types.ObjectId(value)
}

interface CreateMovementInput {
  productId: Types.ObjectId
  type: 'receipt' | 'write-off' | 'adjustment' | 'compensation' | 'reserve' | 'complete' | 'release'
  before: StockSnapshot
  delta: StockDelta
  after: StockSnapshot
  reason?: string | null
  reservationId?: Types.ObjectId | null
  correctionOfId?: Types.ObjectId | null
  actorId?: string | null
}

@Injectable()
export class InventoryMovementsRepository {
  constructor(
    @InjectModel(InventoryMovement.name)
    private readonly movementModel: Model<InventoryMovementDocument>
  ) {}

  async createOne(
    input: CreateMovementInput,
    session: ClientSession
  ): Promise<InventoryMovementDocument> {
    const record = await this.movementModel.create(
      [
        {
          productId: input.productId,
          type: input.type,
          before: input.before,
          delta: input.delta,
          after: input.after,
          reason: input.reason ?? null,
          reservationId: input.reservationId ?? null,
          correctionOfId: input.correctionOfId ?? null,
          actorId: input.actorId ?? null,
        },
      ],
      { session }
    )

    const doc = record[0]

    if (!doc) {
      throw new Error('Inventory movement was not created')
    }

    return doc
  }

  async findById(id: string, session?: ClientSession): Promise<InventoryMovementDocument | null> {
    const objectId = toObjectId(id, 'movement id')
    return this.movementModel
      .findById(objectId)
      .session(session || null)
      .lean<InventoryMovementDocument | null>()
      .exec()
  }

  async list(
    filters: InventoryMovementFilters,
    session?: ClientSession
  ): Promise<InventoryMovementList> {
    const page = filters.page ?? 1
    const limit = filters.limit ?? 20
    const match: Record<string, unknown> = {}

    if (filters.productId) {
      match.productId = toObjectId(filters.productId, 'productId')
    }

    if (filters.type) {
      match.type = filters.type
    }

    if (filters.reservationId) {
      match.reservationId = toObjectId(filters.reservationId, 'reservationId')
    }

    if (filters.correctionOfId) {
      match.correctionOfId = toObjectId(filters.correctionOfId, 'correctionOfId')
    }

    if (filters.from || filters.to) {
      const range: Record<string, unknown> = {}

      if (filters.from) {
        range.$gte = filters.from
      }

      if (filters.to) {
        range.$lte = filters.to
      }

      match.createdAt = range
    }

    const totalItems = await this.movementModel
      .countDocuments(match)
      .session(session || null)
      .exec()
    const docs = await this.movementModel
      .find(match)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .session(session || null)
      .lean<InventoryMovementDocument[]>()
      .exec()

    const totalPages = Math.max(1, Math.ceil(totalItems / limit))

    return {
      items: docs.map((doc) => this.toView(doc)),
      pagination: { page, limit, totalItems, totalPages },
    }
  }

  // Compensations already applied against a movement: sum of negative physical
  // deltas from compensation records that reference it.
  async compensationDeltasFor(
    movementId: Types.ObjectId,
    session: ClientSession
  ): Promise<{ physicalGrams: number; reservedGrams: number }> {
    const rows = await this.movementModel
      .aggregate([
        { $match: { correctionOfId: movementId, type: 'compensation' } },
        {
          $group: {
            _id: null,
            physicalGrams: { $sum: '$delta.physicalGrams' },
            reservedGrams: { $sum: '$delta.reservedGrams' },
          },
        },
      ])
      .session(session)

    if (rows.length === 0) {
      return { physicalGrams: 0, reservedGrams: 0 }
    }

    return {
      physicalGrams: rows[0].physicalGrams || 0,
      reservedGrams: rows[0].reservedGrams || 0,
    }
  }

  private toView(doc: InventoryMovementDocument): {
    id: string
    productId: string
    type:
      'receipt' | 'write-off' | 'adjustment' | 'compensation' | 'reserve' | 'complete' | 'release'
    before: { physicalGrams: number; reservedGrams: number }
    delta: { physicalGrams: number; reservedGrams: number }
    after: { physicalGrams: number; reservedGrams: number }
    reason: string | null
    reservationId: string | null
    correctionOfId: string | null
    actorId: string | null
    createdAt: string
  } {
    return {
      id: String(doc._id),
      productId: String(doc.productId),
      type: doc.type,
      before: { physicalGrams: doc.before.physicalGrams, reservedGrams: doc.before.reservedGrams },
      delta: { physicalGrams: doc.delta.physicalGrams, reservedGrams: doc.delta.reservedGrams },
      after: { physicalGrams: doc.after.physicalGrams, reservedGrams: doc.after.reservedGrams },
      reason: doc.reason ?? null,
      reservationId: doc.reservationId ? String(doc.reservationId) : null,
      correctionOfId: doc.correctionOfId ? String(doc.correctionOfId) : null,
      actorId: doc.actorId ?? null,
      createdAt: doc.createdAt.toISOString(),
    }
  }
}
