import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import type { ClientSession } from 'mongoose'
import { Reservation } from './schemas/reservation.schema.js'
import { Counter } from './schemas/counter.schema.js'
import type { ReservationDocument } from './schemas/reservation.schema.js'
import type {
  ActiveReservationsOverview,
  ReservationFilters,
  ReservationList,
  ReservationListItem,
  ReservationView,
} from './reservations.types.js'

function toObjectId(value: string, field: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${field} must be a valid ObjectId`)
  }
  return new Types.ObjectId(value)
}

interface CreateReservationInput {
  number: string
  source: 'website' | 'admin'
  customerName: string
  customerPhone: string
  status: 'new'
  lines: ReservationLineSnapshotInput[]
  totalGrams: number
  totalAmount: string
  createdByAdminId?: Types.ObjectId | null
}

interface ReservationLineSnapshotInput {
  productId: Types.ObjectId
  productName: string
  variantId: string
  variantWeightGrams: number
  variantPrice: string
  quantity: number
  lineTotal: string
}

@Injectable()
export class ReservationsRepository {
  constructor(
    @InjectModel(Reservation.name)
    private readonly reservationModel: Model<ReservationDocument>,
    @InjectModel(Counter.name) private readonly counterModel: Model<Counter>
  ) {}

  async allocateNumberSequence(): Promise<number> {
    const counter = await this.counterModel
      .findOneAndUpdate(
        { _id: 'reservation-number' },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' }
      )
      .lean()
      .exec()
    if (!counter || !Number.isSafeInteger(counter.seq) || counter.seq < 1) {
      throw new Error('Reservation number allocation failed')
    }
    return counter.seq
  }

  async createOne(
    input: CreateReservationInput,
    session: ClientSession
  ): Promise<ReservationDocument> {
    const record = await this.reservationModel.create(
      [
        {
          number: input.number,
          source: input.source,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          status: input.status,
          lines: input.lines,
          totalGrams: input.totalGrams,
          totalAmount: input.totalAmount,
          createdByAdminId: input.createdByAdminId ?? null,
        },
      ],
      { session }
    )

    const doc = record[0]
    if (!doc) {
      throw new Error('Reservation was not created')
    }
    return doc
  }

  async findById(id: string, session?: ClientSession): Promise<ReservationDocument | null> {
    const objectId = toObjectId(id, 'reservation id')
    return this.reservationModel
      .findById(objectId)
      .session(session || null)
      .exec()
  }

  async getActiveOverview(): Promise<ActiveReservationsOverview> {
    const statuses = ['new', 'confirmed', 'ready'] as const
    const statistics = await this.reservationModel
      .aggregate<{ _id: 'new' | 'confirmed' | 'ready'; count: number }>([
        { $match: { status: { $in: statuses } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      .exec()
    const counts = { new: 0, confirmed: 0, ready: 0 }
    for (const row of statistics) {
      counts[row._id] = row.count
    }
    const recent = await this.reservationModel
      .find({ status: { $in: statuses } })
      .select('number customerName status totalGrams createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .limit(10)
      .lean()
      .exec()
    return {
      counts,
      recent: recent.map((record) => ({
        id: String(record._id),
        number: typeof record.number === 'string' ? record.number : '',
        customerName: typeof record.customerName === 'string' ? record.customerName : '',
        status: record.status as 'new' | 'confirmed' | 'ready',
        totalGrams: typeof record.totalGrams === 'number' ? record.totalGrams : 0,
        createdAt:
          record.createdAt instanceof Date
            ? record.createdAt.toISOString()
            : String(record.createdAt),
      })),
    }
  }

  async list(filters: ReservationFilters, session?: ClientSession): Promise<ReservationList> {
    const page = filters.page ?? 1
    const limit = filters.limit ?? 20
    const match: Record<string, unknown> = {}

    if (filters.status) {
      match.status = filters.status
    }

    if (filters.source) {
      match.source = filters.source
    }

    if (filters.customerName) {
      match.customerName = { $regex: filters.customerName, $options: 'i' }
    }

    if (filters.customerPhone) {
      match.customerPhone = { $regex: filters.customerPhone, $options: 'i' }
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

    const totalItems = await this.reservationModel
      .countDocuments(match)
      .session(session || null)
      .exec()
    const docs = await this.reservationModel
      .find(match)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .session(session || null)
      .lean<ReservationDocument[]>()
      .exec()

    const totalPages = Math.max(1, Math.ceil(totalItems / limit))

    return {
      items: docs.map((doc) => this.toListItem(doc)),
      pagination: { page, limit, totalItems, totalPages },
    }
  }

  async save(doc: ReservationDocument, session: ClientSession): Promise<void> {
    await doc.save({ session })
  }

  private toListItem(doc: ReservationDocument): ReservationListItem {
    return {
      id: String(doc._id),
      number: doc.number,
      source: doc.source,
      customerName: doc.customerName,
      customerPhone: doc.customerPhone,
      status: doc.status,
      totalGrams: doc.totalGrams,
      totalAmount: Number(doc.totalAmount.toString()),
      createdAt: doc.createdAt.toISOString(),
    }
  }

  toView(doc: ReservationDocument): ReservationView {
    return {
      id: String(doc._id),
      number: doc.number,
      source: doc.source,
      customerName: doc.customerName,
      customerPhone: doc.customerPhone,
      status: doc.status,
      lines: doc.lines.map((line) => ({
        productId: String(line.productId),
        productName: line.productName,
        variantId: line.variantId,
        variantWeightGrams: line.variantWeightGrams,
        variantPrice: Number(line.variantPrice.toString()),
        quantity: line.quantity,
        lineTotal: Number(line.lineTotal.toString()),
        grams: line.grams,
      })),
      totalGrams: doc.totalGrams,
      totalAmount: Number(doc.totalAmount.toString()),
      createdByAdminId: doc.createdByAdminId ? String(doc.createdByAdminId) : null,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    }
  }
}
