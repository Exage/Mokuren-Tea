import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Types } from 'mongoose'
import type { HydratedDocument } from 'mongoose'

export type AdminUserDocument = HydratedDocument<AdminUser>

// The historical email/normalizedEmail storage names now hold login identifiers.
// Keep these paths and their unique index so existing accounts remain usable
// without a database migration. API responses expose only `login`.
@Schema({ timestamps: true, collection: 'adminusers' })
export class AdminUser {
  @Prop({ required: true, trim: true, maxlength: 300 })
  email!: string

  @Prop({ required: true, trim: true, lowercase: true, maxlength: 300 })
  normalizedEmail!: string

  @Prop({ required: true, trim: true, maxlength: 300 })
  displayName!: string

  @Prop({ required: true })
  passwordHash!: string

  @Prop({ required: true, default: false })
  mustChangePassword!: boolean

  @Prop({ type: Date, default: null })
  temporaryPasswordExpiresAt!: Date | null

  @Prop({ required: true, default: true })
  isActive!: boolean

  @Prop({ type: Types.ObjectId, default: null })
  createdBy!: Types.ObjectId | null

  @Prop({ type: Date, default: null })
  lastLoginAt!: Date | null

  @Prop({ type: Date })
  createdAt!: Date

  @Prop({ type: Date })
  updatedAt!: Date
}

export const AdminUserSchema = SchemaFactory.createForClass(AdminUser)

// Unique login identifier, protected at the database layer. In production
// autoIndex is disabled; create this index explicitly before accepting writes.
AdminUserSchema.index({ normalizedEmail: 1 }, { unique: true })
