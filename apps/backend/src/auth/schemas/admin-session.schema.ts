import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Types } from 'mongoose'
import type { HydratedDocument } from 'mongoose'

export type AdminSessionDocument = HydratedDocument<AdminSession>

// Server-side session. Only the token hash is stored; the plaintext token is
// never written to the database. Lifetime is 7 days, with a TTL index on
// expiresAt plus application-code expiration validation.
@Schema({ timestamps: true, collection: 'adminsessions' })
export class AdminSession {
  @Prop({ required: true, type: Types.ObjectId })
  adminUserId!: Types.ObjectId

  @Prop({ required: true })
  tokenHash!: string

  @Prop({ required: true, type: Date })
  expiresAt!: Date

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null
}

export const AdminSessionSchema = SchemaFactory.createForClass(AdminSession)

AdminSessionSchema.index({ tokenHash: 1 }, { unique: true })
AdminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
