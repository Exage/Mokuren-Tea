import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectConnection } from '@nestjs/mongoose'
import { Types } from 'mongoose'
import type { ClientSession, Connection } from 'mongoose'
import { AuditService } from '../audit/audit.service.js'
import { ProductsService } from '../products/products.service.js'
import { TasteNotesService } from './taste-notes.service.js'
import type { TasteNoteDocument } from './schemas/taste-note.schema.js'
import type { PublicTasteNoteView } from './taste-notes.types.js'
import { toAdminTasteNote, toPublicTasteNote } from './taste-notes.mapper.js'

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
export class TasteNoteManagementService {
  constructor(
    private readonly tasteNotesService: TasteNotesService,
    private readonly productsService: ProductsService,
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

  // Public discovery: only taste notes referenced by at least one published
  // product are visible. Stock availability does not affect visibility.
  async listPublicTasteNotes(): Promise<PublicTasteNoteView[]> {
    const publishedTasteNoteIds = await this.productsService.findPublishedTasteNoteIds()

    const tasteNotes: TasteNoteDocument[] = []

    for (const id of publishedTasteNoteIds) {
      const tasteNote = await this.tasteNotesService.findById(new Types.ObjectId(id))

      if (tasteNote) {
        tasteNotes.push(tasteNote)
      }
    }

    tasteNotes.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder
      }

      return a._id.toHexString().localeCompare(b._id.toHexString())
    })

    return tasteNotes.map((tasteNote) => toPublicTasteNote(tasteNote))
  }

  // Paginated administrative list. Product counts are grouped for the page's
  // taste-note IDs in a single query and merged in memory; they count every
  // status and are never stored on the taste note.
  async listAdminTasteNotes(query: {
    page?: number
    limit?: number
    search?: string
  }) {
    const page = query.page ?? 1
    const limit = query.limit ?? 20

    const { docs, totalItems } = await this.tasteNotesService.listAdmin(
      page,
      limit,
      query.search
    )
    const ids = docs.map((doc) => String(doc._id))
    const counts = await this.productsService.countProductsByTasteNotes(ids)

    const items = docs.map((doc) => toAdminTasteNote(doc, counts.get(String(doc._id)) || 0))

    return {
      items,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    }
  }

  // Product count for a single taste note, all statuses. Used by the admin
  // controller to populate productsCount on taste-note PATCH responses and
  // the usages endpoint without importing ProductsModule into
  // TasteNotesModule (which would create a circular dependency).
  async countProductsForTasteNote(tasteNoteId: string): Promise<number> {
    const id = toObjectId(tasteNoteId, 'tasteNoteId')
    const exists = await this.tasteNotesService.findById(id)

    if (!exists) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Taste note not found' })
    }

    return this.productsService.countProductsByTasteNote(tasteNoteId)
  }

  // Transactional deletion: remove the taste note from every product (all
  // statuses), then delete the taste note record and record audit, all inside
  // one transaction with reference locks. A repeated request after successful
  // deletion returns 404 and makes no new changes.
  async deleteTasteNote(
    tasteNoteId: string,
    actorId: string | null
  ): Promise<{
    deletedTasteNoteId: string
    affectedProductsCount: number
  }> {
    const id = toObjectId(tasteNoteId, 'tasteNoteId')

    return this.runInTransaction(async (session) => {
      // Acquire the reference lock so concurrent bindings contend on the same
      // document; a missing taste note fails the lock with 404.
      await this.tasteNotesService.lockReferences([id.toHexString()], session)

      const tasteNote = await this.tasteNotesService.findById(id, session)

      if (!tasteNote) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Taste note not found' })
      }

      const result = await this.productsService.unbindTasteNoteFromAllProducts(
        id.toHexString(),
        session
      )

      const affectedProductsCount = result.modified

      await this.tasteNotesService.deleteById(id, session)

      await this.auditService.record(
        {
          actorId,
          action: 'taste-note.deleted',
          entityType: 'taste-note',
          entityId: String(id),
          changes: {},
          metadata: {
            tasteNoteId: String(id),
            tasteNoteName: tasteNote.name,
            tasteNoteSlug: tasteNote.slug,
            affectedProductsCount,
          },
        },
        session
      )

      return {
        deletedTasteNoteId: String(id),
        affectedProductsCount,
      }
    })
  }
}
