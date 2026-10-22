import { toCmsBlockView } from './cms.mapper.js'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import type { ClientSession } from 'mongoose'
import { CmsBlock } from './schemas/cms-block.schema.js'
import type { CmsBlockDocument } from './schemas/cms-block.schema.js'
import { CmsRevision } from './schemas/cms-revision.schema.js'
import type { CmsRevisionDocument } from './schemas/cms-revision.schema.js'
import type {
  CmsBlockKey,
  CmsBlockFilters,
  CmsBlockList,
  CmsRevisionList,
  CmsRevisionView,
} from './cms.types.js'

function toObjectId(value: string, field: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${field} must be a valid ObjectId`)
  }
  return new Types.ObjectId(value)
}

interface CreateBlockInput {
  pageKey: string
  blockKey: CmsBlockKey
  draft: Record<string, unknown> | null
  draftVersion: number
  published: Record<string, unknown> | null
  publishedVersion: number
  updatedBy?: string | null
}

interface UpdateBlockInput {
  draft?: Record<string, unknown> | null
  draftVersion?: number
  published?: Record<string, unknown> | null
  publishedVersion?: number
  updatedBy?: string | null
}

@Injectable()
export class CmsBlocksRepository {
  constructor(@InjectModel(CmsBlock.name) private readonly blockModel: Model<CmsBlockDocument>) {}

  async findByKeys(
    pageKey: string,
    blockKey: CmsBlockKey,
    session?: ClientSession
  ): Promise<CmsBlockDocument | null> {
    return this.blockModel
      .findOne({ pageKey, blockKey })
      .session(session || null)
      .exec()
  }

  async createOne(input: CreateBlockInput, session: ClientSession): Promise<CmsBlockDocument> {
    const record = await this.blockModel.create(
      [
        {
          pageKey: input.pageKey,
          blockKey: input.blockKey,
          draft: input.draft ?? null,
          draftVersion: input.draftVersion,
          published: input.published ?? null,
          publishedVersion: input.publishedVersion,
          updatedBy: input.updatedBy ?? null,
        },
      ],
      { session }
    )

    const doc = record[0]
    if (!doc) {
      throw new Error('CMS block was not created')
    }
    return doc
  }

  async updateByKeys(
    pageKey: string,
    blockKey: CmsBlockKey,
    update: UpdateBlockInput,
    session: ClientSession,
    expectedDraftVersion: number,
    expectedPublishedVersion?: number
  ): Promise<CmsBlockDocument | null> {
    return this.blockModel
      .findOneAndUpdate(
        {
          pageKey,
          blockKey,
          draftVersion: expectedDraftVersion,
          ...(expectedPublishedVersion === undefined
            ? {}
            : { publishedVersion: expectedPublishedVersion }),
        },
        { $set: update },
        { session, returnDocument: 'after' }
      )
      .exec()
  }

  async list(filters: CmsBlockFilters, session?: ClientSession): Promise<CmsBlockList> {
    const page = filters.page ?? 1
    const limit = filters.limit ?? 20
    const match: Record<string, unknown> = {}

    if (filters.pageKey) {
      match.pageKey = filters.pageKey
    }

    if (filters.blockKey) {
      match.blockKey = filters.blockKey
    }

    const totalItems = await this.blockModel
      .countDocuments(match)
      .session(session || null)
      .exec()
    const docs = await this.blockModel
      .find(match)
      .sort({ pageKey: 1, blockKey: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .session(session || null)
      .lean()
      .exec()

    const totalPages = Math.max(1, Math.ceil(totalItems / limit))

    return {
      items: docs.map(toCmsBlockView),
      pagination: { page, limit, totalItems, totalPages },
    }
  }
}

@Injectable()
export class CmsRevisionsRepository {
  constructor(
    @InjectModel(CmsRevision.name) private readonly revisionModel: Model<CmsRevisionDocument>
  ) {}

  async createOne(
    input: {
      pageKey: string
      blockKey: CmsBlockKey
      version: number
      content: Record<string, unknown>
      publishedBy?: string | null
    },
    session: ClientSession
  ): Promise<CmsRevisionDocument> {
    const record = await this.revisionModel.create(
      [
        {
          pageKey: input.pageKey,
          blockKey: input.blockKey,
          version: input.version,
          content: input.content,
          publishedBy: input.publishedBy ?? null,
        },
      ],
      { session }
    )

    const doc = record[0]
    if (!doc) {
      throw new Error('CMS revision was not created')
    }
    return doc
  }

  async listByBlock(
    pageKey: string,
    blockKey: string,
    page: number,
    limit: number,
    session?: ClientSession
  ): Promise<CmsRevisionList> {
    const match: Record<string, unknown> = { pageKey, blockKey }
    const totalItems = await this.revisionModel
      .countDocuments(match)
      .session(session || null)
      .exec()
    const docs = await this.revisionModel
      .find(match)
      .sort({ version: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .session(session || null)
      .lean()
      .exec()

    const totalPages = Math.max(1, Math.ceil(totalItems / limit))

    return {
      items: docs.map((doc: CmsRevisionDocument) => this.toView(doc)),
      pagination: { page, limit, totalItems, totalPages },
    }
  }

  async findById(id: string, session?: ClientSession): Promise<CmsRevisionDocument | null> {
    const objectId = toObjectId(id, 'revision id')
    return this.revisionModel
      .findById(objectId)
      .session(session || null)
      .lean()
      .exec()
  }

  private toView(doc: CmsRevisionDocument): CmsRevisionView {
    return {
      id: String(doc._id),
      pageKey: doc.pageKey,
      blockKey: doc.blockKey,
      version: doc.version,
      content: doc.content,
      publishedBy: doc.publishedBy ?? null,
      publishedAt: doc.createdAt.toISOString(),
    }
  }
}
