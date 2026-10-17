import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

export type AuditLogDocument = HydratedDocument<AuditLog>

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class AuditLog {
  @Prop({ type: String, required: false, default: null })
  actorId!: string | null

  @Prop({ required: true })
  action!: string

  @Prop({ required: true })
  entityType!: string

  @Prop({ type: String, required: false, default: null })
  entityId!: string | null

  @Prop({ type: Object, required: false, default: null })
  changes!: Record<string, unknown> | null

  @Prop({ type: Object, required: false, default: null })
  metadata!: Record<string, unknown> | null
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog)

AuditLogSchema.index({ createdAt: -1 })
AuditLogSchema.index({ entityType: 1, entityId: 1 })
