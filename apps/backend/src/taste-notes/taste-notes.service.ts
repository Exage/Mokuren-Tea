import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectConnection } from '@nestjs/mongoose'
import { Types } from 'mongoose'
import type { ClientSession, Connection } from 'mongoose'
import { AuditService } from '../audit/audit.service.js'
import { TasteNotesRepository } from './taste-notes.repository.js'
import {
  normalizeTasteNoteName,
  normalizeTasteNoteSlug,
  normalizeTasteNoteSortOrder,
} from './taste-notes-normalization.js'
import type { TasteNoteDocument } from './schemas/taste-note.schema.js'
import type { AdminTasteNoteView } from './taste-notes.types.js'
import { toAdminTasteNote } from './taste-notes.mapper.js'

function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === 11000)
}

function toObjectId(value: string, field: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `${field} must be a valid ObjectId`,
    })
  }

  return new Types.ObjectId(value)
}

@Injectable()
export class TasteNotesService {
  constructor(
    private readonly tasteNotesRepository: TasteNotesRepository,
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
    } finally {
      await session.endSession()
    }
  }

  async create(
    dto: { name: unknown; slug: unknown; sortOrder?: unknown },
    actorId: string | null
  ): Promise<AdminTasteNoteView> {
    const name = normalizeTasteNoteName(dto.name)
    const slug = normalizeTasteNoteSlug(dto.slug)
    const sortOrder = normalizeTasteNoteSortOrder(dto.sortOrder)

    return this.runInTransaction(async (session) => {
      if (!this.tasteNotesRepository.isReady()) {
        throw new BadRequestException({
          code: 'SERVICE_UNAVAILABLE',
          message: 'Database is not ready',
        })
      }

      const existing = await this.tasteNotesRepository.findBySlug(slug)

      if (existing) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Taste note slug is already used',
        })
      }

      let created: TasteNoteDocument

      try {
        const records = await this.tasteNotesRepository.create(
          { name, slug, sortOrder, referenceRevision: 0 },
          session
        )

        created = records[0] as TasteNoteDocument

        if (!created) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: 'Taste note was not created',
          })
        }
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          throw new ConflictException({
            code: 'CONFLICT',
            message: 'Taste note slug is already used',
          })
        }

        throw error
      }

      await this.auditService.record(
        {
          actorId,
          action: 'taste-note.created',
          entityType: 'taste-note',
          entityId: String(created._id),
          changes: { name, slug, sortOrder },
        },
        session
      )

      return toAdminTasteNote(created, 0)
    })
  }

  async update(
    id: string,
    dto: { name?: unknown; slug?: unknown; sortOrder?: unknown },
    actorId: string | null,
    productsCount: number = 0
  ): Promise<AdminTasteNoteView> {
    const tasteNoteId = toObjectId(id, 'tasteNoteId')

    const hasName = dto.name !== undefined
    const hasSlug = dto.slug !== undefined
    const hasSortOrder = dto.sortOrder !== undefined

    if (!hasName && !hasSlug && !hasSortOrder) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'PATCH body is empty',
      })
    }

    if (hasName && dto.name === null) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'name must be a string',
      })
    }

    if (hasSlug && dto.slug === null) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'slug must be a string',
      })
    }

    if (hasSortOrder && dto.sortOrder === null) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'sortOrder must be a nonnegative safe integer',
      })
    }

    return this.runInTransaction(async (session) => {
      const tasteNote = await this.tasteNotesRepository.findById(tasteNoteId, session)

      if (!tasteNote) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Taste note not found' })
      }

      const changes: Record<string, unknown> = {}
      let slugChanged = false
      let nextSlug: string | undefined

      if (hasName) {
        const name = normalizeTasteNoteName(dto.name as string)

        if (name !== tasteNote.name) {
          tasteNote.name = name
          changes.name = name
        }
      }

      if (hasSlug) {
        const slug = normalizeTasteNoteSlug(dto.slug as string)

        if (slug !== tasteNote.slug) {
          nextSlug = slug
          slugChanged = true
          changes.slug = slug
        }
      }

      if (hasSortOrder) {
        const sortOrder = normalizeTasteNoteSortOrder(dto.sortOrder as number)

        if (sortOrder !== tasteNote.sortOrder) {
          tasteNote.sortOrder = sortOrder
          changes.sortOrder = sortOrder
        }
      }

      if (Object.keys(changes).length === 0) {
        // No actual change: return the current view without mutating
        // timestamps or recording a mutation audit event.
        return toAdminTasteNote(tasteNote, productsCount)
      }

      if (slugChanged && nextSlug) {
        const existing = await this.tasteNotesRepository.findBySlug(nextSlug)

        if (existing && !existing._id.equals(tasteNoteId)) {
          throw new ConflictException({
            code: 'CONFLICT',
            message: 'Taste note slug is already used',
          })
        }

        tasteNote.slug = nextSlug
      }

      try {
        await this.tasteNotesRepository.save(tasteNote, session)
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          throw new ConflictException({
            code: 'CONFLICT',
            message: 'Taste note slug is already used',
          })
        }

        throw error
      }

      await this.auditService.record(
        {
          actorId,
          action: 'taste-note.updated',
          entityType: 'taste-note',
          entityId: String(tasteNote._id),
          changes,
        },
        session
      )

      return toAdminTasteNote(tasteNote, productsCount)
    })
  }

  // Service-facing reads used by foreign features (products) as the taste-note
  // boundary. Repositories stay private to this module.
  async findById(id: Types.ObjectId, session?: ClientSession): Promise<TasteNoteDocument | null> {
    return this.tasteNotesRepository.findById(id, session)
  }

  async findByIds(ids: Types.ObjectId[], session?: ClientSession): Promise<TasteNoteDocument[]> {
    return this.tasteNotesRepository.findByIds(ids, session)
  }

  async findBySlug(slug: string): Promise<{ _id: Types.ObjectId } | null> {
    return this.tasteNotesRepository.findBySlug(slug)
  }

  /**
   * lockReferences acquires a transaction-scoped write on each taste note so
   * concurrent bindings and deletions contend on the same documents. It is a
   * contention mechanism, not a persistent lock: the counter is never
   * decremented and never exposed in API DTOs. A caller-owned ClientSession
   * is required.
   */
  async lockReferences(tasteNoteIds: string[], session: ClientSession): Promise<void> {
    const ids = tasteNoteIds
      .map((id) => toObjectId(id, 'tasteNoteId'))
      .filter((id, index, arr) => arr.findIndex((other) => other.equals(id)) === index)
      .sort((a, b) => a.toHexString().localeCompare(b.toHexString()))

    for (const id of ids) {
      const result = await this.tasteNotesRepository.incrementReferenceRevision(id, session)

      if (result.matchedCount === 0) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Taste note not found',
        })
      }
    }
  }

  async listAdmin(page: number, limit: number, search?: string) {
    return this.tasteNotesRepository.listAdmin(page, limit, search)
  }

  async deleteById(id: Types.ObjectId, session: ClientSession): Promise<void> {
    const result = await this.tasteNotesRepository.deleteById(id, session)

    if (result.deletedCount !== 1) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Taste note not found' })
    }
  }
}
