import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import type { ClientSession, Types } from 'mongoose'
import { AdminSession } from './schemas/admin-session.schema.js'
import type { AdminSessionDocument } from './schemas/admin-session.schema.js'

// Persistence boundary for server-side sessions. Only token hashes are stored.
@Injectable()
export class AdminSessionRepository {
  constructor(
    @InjectModel(AdminSession.name)
    private readonly adminSessionModel: Model<AdminSessionDocument>
  ) {}

  create(adminSession: AdminSession, session: ClientSession) {
    return this.adminSessionModel.create([adminSession], { session })
  }

  async revoke(tokenHash: string, session: ClientSession | null): Promise<void> {
    await this.adminSessionModel
      .updateOne(
        { tokenHash },
        { $set: { revokedAt: new Date() } },
        { session: session ?? undefined }
      )
      .exec()
  }

  async revokeAllForUser(adminUserId: Types.ObjectId, session: ClientSession): Promise<number> {
    const result = await this.adminSessionModel
      .updateMany(
        { adminUserId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
        { session }
      )
      .exec()
    return result.modifiedCount
  }
}
