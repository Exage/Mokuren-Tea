import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common'
import { InjectConnection, InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import type { ClientSession, Connection } from 'mongoose'
import { AuditService } from '../audit/audit.service.js'
import { StoreSettings } from './schemas/store-settings.schema.js'
import type { StoreSettingsDocument } from './schemas/store-settings.schema.js'
import type { StoreSettingsView, UpdateStoreSettingsInput } from './store-settings.types.js'

const SETTINGS_ID = 'settings'

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: `${field} is required` })
  }
  return value.trim()
}

@Injectable()
export class StoreSettingsService {
  constructor(
    @InjectModel(StoreSettings.name) private readonly settingsModel: Model<StoreSettingsDocument>,
    private readonly auditService: AuditService,
    @InjectConnection() private readonly connection: Connection
  ) {}

  private async runInTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession()
    try {
      let result: T | undefined
      await session.withTransaction(async () => {
        result = await work(session)
      })
      return result as T
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'VersionError') {
        throw new ConflictException({
          code: 'CONCURRENT_UPDATE',
          message: 'Store settings changed concurrently',
        })
      }
      throw error
    } finally {
      await session.endSession()
    }
  }

  async getSettings(): Promise<StoreSettingsView | null> {
    const doc = await this.settingsModel
      .findOne({ _id: SETTINGS_ID })
      .lean<StoreSettingsDocument | null>()
      .exec()
    if (!doc) {
      return null
    }
    return this.toView(doc)
  }

  async updateSettings(
    input: UpdateStoreSettingsInput,
    actorId: string | null
  ): Promise<StoreSettingsView> {
    return this.runInTransaction(async (session) => {
      const doc = await this.settingsModel.findOne({ _id: SETTINGS_ID }).session(session).exec()

      if (!doc) {
        throw new ServiceUnavailableException({
          code: 'STORE_SETTINGS_NOT_INITIALIZED',
          message: 'Store settings not initialized',
        })
      }

      const changes: Record<string, unknown> = {}

      if (input.name !== undefined) {
        const name = requireNonEmptyString(input.name, 'name')
        if (name !== doc.name) {
          doc.name = name
          changes.name = name
        }
      }

      if (input.tagline !== undefined) {
        const tagline =
          input.tagline === null ? null : requireNonEmptyString(input.tagline, 'tagline')
        if (tagline !== doc.tagline) {
          doc.tagline = tagline
          changes.tagline = tagline
        }
      }

      if (input.address !== undefined) {
        const address =
          input.address === null ? null : requireNonEmptyString(input.address, 'address')
        if (address !== doc.address) {
          doc.address = address
          changes.address = address
        }
      }

      if (input.hours !== undefined) {
        const hours = input.hours === null ? null : requireNonEmptyString(input.hours, 'hours')
        if (hours !== doc.hours) {
          doc.hours = hours
          changes.hours = hours
        }
      }

      if (input.phone !== undefined) {
        const phone = input.phone === null ? null : requireNonEmptyString(input.phone, 'phone')
        if (phone !== doc.phone) {
          doc.phone = phone
          changes.phone = phone
        }
      }

      if (input.contacts !== undefined) {
        if (JSON.stringify(input.contacts) !== JSON.stringify(doc.contacts)) {
          doc.contacts = input.contacts
          changes.contacts = input.contacts
        }
      }

      if (Object.keys(changes).length === 0) {
        return this.toView(doc)
      }

      await doc.save({ session })
      await this.auditService.record(
        {
          actorId,
          action: 'store.settings.updated',
          entityType: 'store-settings',
          entityId: SETTINGS_ID,
          changes,
        },
        session
      )

      return this.toView(doc)
    })
  }

  async initializeDefaultSettings(
    defaults: {
      name: string
      tagline?: string | null
      address?: string | null
      hours?: string | null
      phone?: string | null
      contacts?: Record<string, unknown> | null
    },
    actorId: string | null
  ): Promise<StoreSettingsView> {
    try {
      return await this.runInTransaction(async (session) => {
        const existing = await this.settingsModel
          .findOne({ _id: SETTINGS_ID })
          .session(session)
          .exec()
        if (existing) {
          return this.toView(existing)
        }
        const doc = await this.settingsModel.create(
          [
            {
              _id: SETTINGS_ID,
              name: defaults.name,
              tagline: defaults.tagline ?? null,
              address: defaults.address ?? null,
              hours: defaults.hours ?? null,
              phone: defaults.phone ?? null,
              contacts: defaults.contacts ?? null,
            },
          ],
          { session }
        )

        const created = doc[0]
        if (!created) {
          throw new Error('Store settings were not created')
        }

        await this.auditService.record(
          {
            actorId,
            action: 'store.settings.initialized',
            entityType: 'store-settings',
            entityId: SETTINGS_ID,
            changes: { name: defaults.name },
          },
          session
        )

        return this.toView(created)
      })
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        const existing = await this.getSettings()
        if (existing) {
          return existing
        }
      }
      throw error
    }
  }

  private toView(doc: StoreSettingsDocument): StoreSettingsView {
    return {
      id: String(doc._id),
      name: doc.name,
      tagline: doc.tagline,
      address: doc.address,
      hours: doc.hours,
      phone: doc.phone,
      contacts: doc.contacts,
      updatedAt: doc.updatedAt.toISOString(),
    }
  }
}
