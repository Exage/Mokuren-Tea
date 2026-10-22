import { Injectable } from '@nestjs/common'
import { InjectConnection, InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import type { ClientSession, Connection, Types } from 'mongoose'
import { Category } from './schemas/category.schema.js'
import type { CategoryDocument } from './schemas/category.schema.js'

@Injectable()
export class CategoriesRepository {
  constructor(
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    @InjectConnection() private readonly connection: Connection
  ) {}

  isReady(): boolean {
    return Boolean(this.connection.db)
  }

  findById(id: Types.ObjectId, session?: ClientSession) {
    return this.categoryModel
      .findById(id)
      .session(session || null)
      .exec()
  }

  findBySlug(slug: string) {
    return this.categoryModel.findOne({ slug }).lean().exec()
  }

  async listAdmin(page: number, limit: number, search?: string) {
    const filter: Record<string, unknown> = {}

    if (search && search.trim().length > 0) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { slug: { $regex: escaped, $options: 'i' } },
      ]
    }

    const totalItems = await this.categoryModel.countDocuments(filter).exec()
    const docs = await this.categoryModel
      .find(filter)
      .sort({ sortOrder: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec()

    return { docs, totalItems }
  }

  create(category: Category, session: ClientSession) {
    return this.categoryModel.create([category], { session })
  }

  save(category: CategoryDocument, session: ClientSession) {
    return category.save({ session })
  }

  incrementReferenceRevision(id: Types.ObjectId, session: ClientSession) {
    return this.categoryModel
      .updateOne({ _id: id }, { $inc: { referenceRevision: 1 } }, { session, timestamps: false })
      .exec()
  }

  deleteById(id: Types.ObjectId, session: ClientSession) {
    return this.categoryModel.deleteOne({ _id: id }, { session }).exec()
  }
}
