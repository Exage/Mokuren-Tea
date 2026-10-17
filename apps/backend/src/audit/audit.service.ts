import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
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
}
