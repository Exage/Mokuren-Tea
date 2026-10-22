import type { ReservationEventView } from './reservations.types.js'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import type { ClientSession } from 'mongoose'
import { ReservationEvent } from './schemas/reservation-event.schema.js'
import type { ReservationEventDocument } from './schemas/reservation-event.schema.js'

interface CreateEventInput {
  reservationId: Types.ObjectId
  action: 'created' | 'edited' | 'status-changed'
  oldStatus?: string | null
  newStatus?: string | null
  changes?: Record<string, unknown> | null
  actorId?: string | null
}

@Injectable()
export class ReservationEventsRepository {
  constructor(
    @InjectModel(ReservationEvent.name)
    private readonly eventModel: Model<ReservationEventDocument>
  ) {}

  async createOne(
    input: CreateEventInput,
    session: ClientSession
  ): Promise<ReservationEventDocument> {
    const record = await this.eventModel.create(
      [
        {
          reservationId: input.reservationId,
          action: input.action,
          oldStatus: input.oldStatus ?? null,
          newStatus: input.newStatus ?? null,
          changes: input.changes ?? null,
          actorId: input.actorId ?? null,
        },
      ],
      { session }
    )

    const doc = record[0]
    if (!doc) {
      throw new Error('Reservation event was not created')
    }
    return doc
  }

  async listByReservation(
    reservationId: string,
    session?: ClientSession
  ): Promise<ReservationEventView[]> {
    const objectId = new Types.ObjectId(reservationId)
    const docs = await this.eventModel
      .find({ reservationId: objectId })
      .sort({ createdAt: 1, _id: 1 })
      .session(session || null)
      .lean<ReservationEventDocument[]>()
      .exec()

    return docs.map((doc) => ({
      id: String(doc._id),
      action: doc.action,
      oldStatus: doc.oldStatus ?? null,
      newStatus: doc.newStatus ?? null,
      changes: doc.changes ?? null,
      actorId: doc.actorId ?? null,
      createdAt: doc.createdAt.toISOString(),
    }))
  }
}
