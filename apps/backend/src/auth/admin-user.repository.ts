import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import type { ClientSession } from 'mongoose'
import { AdminUser } from './schemas/admin-user.schema.js'
import type { AdminUserDocument } from './schemas/admin-user.schema.js'

// Persistence boundary for administrator accounts. Returns documents or absence;
// the service decides what absence or a failed condition means.
@Injectable()
export class AdminUserRepository {
  constructor(
    @InjectModel(AdminUser.name) private readonly adminUserModel: Model<AdminUserDocument>,
  ) {}

  async initializeMutationGuard(): Promise<void> {
    await this.adminUserModel.db.collection('admin_mutation_locks').updateOne(
      { _id: new Types.ObjectId('000000000000000000000000') },
      { $setOnInsert: { revision: 0 } },
      { upsert: true },
    )
  }

  async acquireMutationGuard(session: ClientSession): Promise<void> {
    // A real write forces competing transactions to retry with a fresh
    // snapshot. MongoDB releases the write lock on commit, abort, or crash.
    await this.adminUserModel.db.collection('admin_mutation_locks').updateOne(
      { _id: new Types.ObjectId('000000000000000000000000') },
      { $inc: { revision: 1 } },
      { session },
    )
  }

  findById(id: string, session?: ClientSession) {
    return this.adminUserModel.findById(id).session(session || null).exec()
  }

  findByNormalizedEmail(normalizedEmail: string, session?: ClientSession) {
    return this.adminUserModel.findOne({ normalizedEmail }).session(session || null).exec()
  }

  countActiveExcluding(session: ClientSession, excludeId: Types.ObjectId) {
    return this.adminUserModel.countDocuments({ _id: { $ne: excludeId }, isActive: true }).session(session || null).exec()
  }

  async listAdmin(page: number, limit: number, search?: string) {
    const filter: Record<string, unknown> = {}

    if (search && search.trim().length > 0) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter.$or = [
        { email: { $regex: escaped, $options: 'i' } },
        { normalizedEmail: { $regex: escaped, $options: 'i' } },
        { displayName: { $regex: escaped, $options: 'i' } },
      ]
    }

    const totalItems = await this.adminUserModel.countDocuments(filter).exec()
    const docs = await this.adminUserModel
      .find(filter)
      .sort({ createdAt: -1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec()

    return { docs, totalItems }
  }

  async create(adminUser: AdminUser, session: ClientSession): Promise<AdminUserDocument> {
    const records = await this.adminUserModel.create([adminUser], { session })
    const created = records[0]

    if (!created) {
      throw new Error('Admin user was not created')
    }

    return created
  }

  save(adminUser: AdminUserDocument, session: ClientSession) {
    return adminUser.save({ session })
  }
}
