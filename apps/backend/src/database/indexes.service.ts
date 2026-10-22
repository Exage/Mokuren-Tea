import { Logger } from '@nestjs/common'
import type { Connection } from 'mongoose'

const UNIQUE_KEYS = [
  { collection: 'inventories', fields: { productId: '$productId' } },
  { collection: 'reservations', fields: { number: '$number' } },
  { collection: 'idempotencykeys', fields: { key: '$key' } },
  { collection: 'cmsblocks', fields: { pageKey: '$pageKey', blockKey: '$blockKey' } },
  {
    collection: 'cmsrevisions',
    fields: { pageKey: '$pageKey', blockKey: '$blockKey', version: '$version' },
  },
] as const

const MODELS = [
  'Inventory',
  'InventoryMovement',
  'Reservation',
  'ReservationEvent',
  'IdempotencyKey',
  'CmsBlock',
  'CmsRevision',
  'StoreSettings',
  'AuditLog',
] as const

export class IndexesService {
  constructor(private readonly connection: Connection) {}

  async report(): Promise<number> {
    const db = this.connection.db
    if (!db) {
      throw new Error('Database is not connected')
    }

    let duplicateGroups = 0
    for (const key of UNIQUE_KEYS) {
      const duplicates = await db
        .collection(key.collection)
        .aggregate([
          { $group: { _id: key.fields, count: { $sum: 1 } } },
          { $match: { count: { $gt: 1 } } },
          { $limit: 20 },
        ])
        .toArray()
      duplicateGroups += duplicates.length
      Logger.log(
        `${key.collection}: ${duplicates.length} duplicate unique-key groups`,
        'IndexReport'
      )
    }

    const stockWithoutHistory = await db
      .collection('inventories')
      .aggregate([
        { $match: { $or: [{ physicalGrams: { $gt: 0 } }, { reservedGrams: { $gt: 0 } }] } },
        {
          $lookup: {
            from: 'inventorymovements',
            localField: 'productId',
            foreignField: 'productId',
            as: 'movements',
          },
        },
        { $match: { movements: { $size: 0 } } },
        { $count: 'count' },
      ])
      .toArray()
    Logger.log(
      `Nonzero inventory rows without movement history: ${stockWithoutHistory[0]?.count || 0}`,
      'IndexReport'
    )
    return duplicateGroups
  }

  async ensure(): Promise<void> {
    for (const name of MODELS) {
      await this.connection.model(name).createIndexes()
      Logger.log(`Indexes ensured for ${name}`, 'IndexReport')
    }
  }
}
