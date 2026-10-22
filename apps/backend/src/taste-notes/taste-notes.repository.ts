import { Injectable } from '@nestjs/common'
import { InjectConnection, InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import type { ClientSession, Connection, Types } from 'mongoose'
import { TasteNote } from './schemas/taste-note.schema.js'
import type { TasteNoteDocument } from './schemas/taste-note.schema.js'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

@Injectable()
export class TasteNotesRepository {
  constructor(
    @InjectModel(TasteNote.name) private readonly tasteNoteModel: Model<TasteNoteDocument>,
    @InjectConnection() private readonly connection: Connection
  ) {}

  isReady(): boolean {
    return Boolean(this.connection.db)
  }

  findById(id: Types.ObjectId, session?: ClientSession) {
    return this.tasteNoteModel
      .findById(id)
      .session(session || null)
      .exec()
  }

  findByIds(ids: Types.ObjectId[], session?: ClientSession) {
    return this.tasteNoteModel
      .find({ _id: { $in: ids } })
      .session(session || null)
      .exec()
  }

  findBySlug(slug: string) {
    return this.tasteNoteModel.findOne({ slug }).lean().exec()
  }

  async listAdmin(page: number, limit: number, search?: string) {
    const filter: Record<string, unknown> = {}

    if (search && search.trim().length > 0) {
      const escaped = escapeRegExp(search.trim())
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { slug: { $regex: escaped, $options: 'i' } },
      ]
    }

    const totalItems = await this.tasteNoteModel.countDocuments(filter).exec()
    const docs = await this.tasteNoteModel
      .find(filter)
      .sort({ sortOrder: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec()

    return { docs, totalItems }
  }

  create(tasteNote: TasteNote, session: ClientSession) {
    return this.tasteNoteModel.create([tasteNote], { session })
  }

  save(tasteNote: TasteNoteDocument, session: ClientSession) {
    return tasteNote.save({ session })
  }

  incrementReferenceRevision(id: Types.ObjectId, session: ClientSession) {
    return this.tasteNoteModel
      .updateOne({ _id: id }, { $inc: { referenceRevision: 1 } }, { session, timestamps: false })
      .exec()
  }

  deleteById(id: Types.ObjectId, session: ClientSession) {
    return this.tasteNoteModel.deleteOne({ _id: id }, { session }).exec()
  }
}
