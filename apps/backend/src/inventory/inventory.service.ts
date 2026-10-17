import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import type { ClientSession } from 'mongoose'
import { Inventory } from './schemas/inventory.schema.js'

export interface StockLevels {
  physicalGrams: number
  reservedGrams: number
}

const ZERO_STOCK: StockLevels = { physicalGrams: 0, reservedGrams: 0 }

@Injectable()
export class InventoryService {
  constructor(@InjectModel(Inventory.name) private readonly inventoryModel: Model<Inventory>) {}

  // Creates the mandatory zero stock row inside the caller's transaction.
  async createZeroStock(productId: Types.ObjectId, session: ClientSession): Promise<void> {
    await this.inventoryModel.create([{ productId, physicalGrams: 0, reservedGrams: 0 }], {
      session,
    })
  }

  async getStockFor(productId: Types.ObjectId, session?: ClientSession): Promise<StockLevels> {
    const record = await this.inventoryModel
      .findOne({ productId })
      .session(session || null)
      .lean<{ physicalGrams: number; reservedGrams: number } | null>()
      .exec()

    if (!record) {
      return { ...ZERO_STOCK }
    }

    return { physicalGrams: record.physicalGrams, reservedGrams: record.reservedGrams }
  }

  async getStockForMany(
    productIds: Types.ObjectId[],
    session?: ClientSession
  ): Promise<Map<string, StockLevels>> {
    const result = new Map<string, StockLevels>()

    if (productIds.length === 0) {
      return result
    }

    const records = await this.inventoryModel
      .find({ productId: { $in: productIds } })
      .session(session || null)
      .lean<{ productId: Types.ObjectId; physicalGrams: number; reservedGrams: number }[]>()
      .exec()

    for (const record of records) {
      result.set(String(record.productId), {
        physicalGrams: record.physicalGrams,
        reservedGrams: record.reservedGrams,
      })
    }

    return result
  }
}
