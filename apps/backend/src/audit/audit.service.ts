import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import type { ClientSession } from 'mongoose'
import { AuditLog } from './schemas/audit-log.schema.js'

export interface AuditEntry {
  actorId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  changes?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

export interface AuditLogFilters {
  actorId?: string
  action?: string
  entityType?: string
  entityId?: string
  from?: Date
  to?: Date
  page?: number
  limit?: number
}

export interface AuditLogView {
  id: string
  actorId: string | null
  action: string
  entityType: string
  entityId: string | null
  changes: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface AuditLogList {
  items: AuditLogView[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
}

// Minimal append-only audit writer. Records are created inside the caller's
// transaction session so business change and audit entry commit atomically.
@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLog>) {}

  async record(entry: AuditEntry, session?: ClientSession): Promise<void> {
    await this.auditModel.create(
      [
        {
          actorId: entry.actorId || null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId || null,
          changes: entry.changes || null,
          metadata: entry.metadata || null,
        },
      ],
      { session: session || undefined }
    )
  }

  async list(filters: AuditLogFilters): Promise<AuditLogList> {
    const page = filters.page ?? 1
    const limit = filters.limit ?? 50
    const match: Record<string, unknown> = {}

    if (filters.actorId) {
      match.actorId = filters.actorId
    }

    if (filters.action) {
      match.action = filters.action
    }

    if (filters.entityType) {
      match.entityType = filters.entityType
    }

    if (filters.entityId) {
      match.entityId = filters.entityId
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

    const totalItems = await this.auditModel.countDocuments(match).exec()
    const docs = await this.auditModel
      .find(match)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec()

    const totalPages = Math.max(1, Math.ceil(totalItems / limit))

    return {
      items: (docs as unknown as Array<{ _id: Types.ObjectId; actorId: string | null; action: string; entityType: string; entityId: string | null; changes: Record<string, unknown> | null; metadata: Record<string, unknown> | null; createdAt: Date | string }>).map((doc) => ({
        id: String(doc._id),
        actorId: doc.actorId,
        action: doc.action,
        entityType: doc.entityType,
        entityId: doc.entityId,
        changes: doc.changes,
        metadata: doc.metadata,
        createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
      })),
      pagination: { page, limit, totalItems, totalPages },
    }
  }
}
