import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectConnection } from '@nestjs/mongoose'
import { Types } from 'mongoose'
import type { ClientSession, Connection } from 'mongoose'
import { ProductsService } from '../products/products.service.js'
import { ProductCatalogService } from '../products/product-catalog.service.js'
import type { PublicProductView } from '../products/products.types.js'
import type { ResolvedImage } from '../media-assets/media-assets.types.js'
import { MediaAssetsService } from '../media-assets/media-assets.service.js'
import { AuditService } from '../audit/audit.service.js'
import { CmsBlocksRepository } from './cms.repository.js'
import { CmsRevisionsRepository } from './cms.repository.js'
import { toCmsBlockView } from './cms.mapper.js'
import type {
  CmsBlockKey,
  CmsBlockView,
  CmsBlockList,
  CmsPagePreview,
  CmsRevisionList,
  PublishCmsBlockInput,
  RestoreCmsRevisionInput,
  SaveCmsDraftInput,
} from './cms.types.js'
import { validateBlockContent } from './cms-content-validation.js'

function requireBlock(pageKey: string, blockKey: CmsBlockKey): void {
  if (!CMS_BLOCK_KEYS_FOR_PAGE[pageKey]?.includes(blockKey)) {
    throw new NotFoundException({ code: 'NOT_FOUND', message: 'CMS block not found' })
  }
}

function requirePage(pageKey: string): void {
  if (!CMS_BLOCK_KEYS_FOR_PAGE[pageKey]) {
    throw new NotFoundException({ code: 'NOT_FOUND', message: 'CMS page not found' })
  }
}

const CMS_PAGE_KEYS: string[] = ['home', 'catalog', 'about', 'contacts']

@Injectable()
export class CmsService {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productCatalogService: ProductCatalogService,
    private readonly mediaAssetsService: MediaAssetsService,
    private readonly blocksRepository: CmsBlocksRepository,
    private readonly revisionsRepository: CmsRevisionsRepository,
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

  private imageId(content: Record<string, unknown> | null): string | null {
    return typeof content?.imageId === 'string' ? content.imageId : null
  }

  private async replaceImageUsage(
    previous: Record<string, unknown> | null,
    next: Record<string, unknown> | null,
    session: ClientSession
  ): Promise<void> {
    const before = this.imageId(previous)
    const after = this.imageId(next)
    if (before === after) {
      return
    }
    if (after) {
      await this.mediaAssetsService.incrementUsageFor([after], session)
    }
    if (before) {
      await this.mediaAssetsService.decrementUsageFor([before], session)
    }
  }

  // Ensure every fixed block exists for every page key. Repeatable: existing
  // blocks are never overwritten.
  async initializeFixedBlocks(actorId: string | null): Promise<void> {
    const session = await this.connection.startSession()
    try {
      await session.withTransaction(async () => {
        for (const pageKey of CMS_PAGE_KEYS) {
          const blocksForPage = CMS_BLOCK_KEYS_FOR_PAGE[pageKey] ?? []

          for (const blockKey of blocksForPage) {
            const existing = await this.blocksRepository.findByKeys(pageKey, blockKey, session)
            if (existing) {
              continue
            }

            await this.blocksRepository.createOne(
              {
                pageKey,
                blockKey,
                draft: null,
                draftVersion: 0,
                published: null,
                publishedVersion: 0,
                updatedBy: actorId,
              },
              session
            )

            await this.auditService.record(
              {
                actorId,
                action: 'cms.block.initialized',
                entityType: 'cms-block',
                entityId: `${pageKey}.${blockKey}`,
                changes: { pageKey, blockKey },
              },
              session
            )
          }
        }
      })
    } finally {
      await session.endSession()
    }
  }

  // ---- Public: read published content ----

  private async presentPublishedBlock(
    content: Record<string, unknown> | null,
    version: number
  ): Promise<{
    content: Record<string, unknown> | null
    version: number
    image: ResolvedImage | null
    products: PublicProductView[]
  }> {
    const imageId = this.imageId(content)
    const productIds = Array.isArray(content?.teaIds)
      ? content.teaIds.filter((id): id is string => typeof id === 'string')
      : []
    const [images, products] = await Promise.all([
      imageId ? this.mediaAssetsService.resolvePublicImages([imageId], 'detail') : [],
      productIds.length ? this.productCatalogService.getPublishedByIds(productIds) : [],
    ])
    return { content, version, image: images[0] || null, products }
  }

  async getPublishedBlock(pageKey: string, blockKey: CmsBlockKey) {
    requireBlock(pageKey, blockKey)
    const doc = await this.blocksRepository.findByKeys(pageKey, blockKey)
    if (!doc) {
      return this.presentPublishedBlock(null, 0)
    }
    return this.presentPublishedBlock(doc.published ?? null, doc.publishedVersion)
  }

  async getPublishedPage(pageKey: string) {
    requirePage(pageKey)
    const blocksForPage = CMS_BLOCK_KEYS_FOR_PAGE[pageKey] ?? []
    const result: Record<string, Awaited<ReturnType<CmsService['presentPublishedBlock']>>> = {}

    for (const blockKey of blocksForPage) {
      const doc = await this.blocksRepository.findByKeys(pageKey, blockKey)
      result[blockKey] = await this.presentPublishedBlock(
        doc?.published ?? null,
        doc?.publishedVersion ?? 0
      )
    }

    return { pageKey, blocks: result }
  }

  // ---- Admin: read draft + published ----

  async getBlockAdmin(pageKey: string, blockKey: CmsBlockKey): Promise<CmsBlockView> {
    requireBlock(pageKey, blockKey)
    const doc = await this.blocksRepository.findByKeys(pageKey, blockKey)
    if (!doc) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'CMS block not found' })
    }
    return toCmsBlockView(doc)
  }

  async listBlocksAdmin(): Promise<CmsBlockList> {
    return this.blocksRepository.list({ page: 1, limit: 100 })
  }

  // ---- Admin: save draft with version check ----

  async saveDraft(input: SaveCmsDraftInput): Promise<CmsBlockView> {
    requireBlock(input.pageKey, input.blockKey)
    const validation = validateBlockContent(input.blockKey, input.content)
    if (!validation.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid block content',
        details: validation.errors,
      })
    }

    return this.runInTransaction(async (session) => {
      const doc = await this.blocksRepository.findByKeys(input.pageKey, input.blockKey, session)
      if (!doc) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'CMS block not found' })
      }

      if (doc.draftVersion !== input.expectedDraftVersion) {
        throw new ConflictException({
          code: 'STALE_VERSION',
          message: `Draft version mismatch: expected ${input.expectedDraftVersion}, current ${doc.draftVersion}`,
        })
      }

      const nextVersion = doc.draftVersion + 1
      await this.replaceImageUsage(doc.draft, validation.data, session)
      const updated = await this.blocksRepository.updateByKeys(
        input.pageKey,
        input.blockKey,
        {
          draft: validation.data,
          draftVersion: nextVersion,
          updatedBy: input.actorId ?? null,
        },
        session,
        doc.draftVersion
      )

      if (!updated) {
        throw new ConflictException({
          code: 'STALE_VERSION',
          message: 'Draft was modified concurrently, please retry',
        })
      }

      await this.auditService.record(
        {
          actorId: input.actorId ?? null,
          action: 'cms.draft.saved',
          entityType: 'cms-block',
          entityId: `${input.pageKey}.${input.blockKey}`,
          changes: { blockKey: input.blockKey, draftVersion: nextVersion },
        },
        session
      )

      return toCmsBlockView(updated)
    })
  }

  // ---- Admin: publish one block (atomic) ----

  async publishBlock(input: PublishCmsBlockInput): Promise<CmsBlockView> {
    requireBlock(input.pageKey, input.blockKey)
    return this.runInTransaction(async (session) => {
      const doc = await this.blocksRepository.findByKeys(input.pageKey, input.blockKey, session)
      if (!doc) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'CMS block not found' })
      }

      if (!doc.draft || doc.draftVersion === 0) {
        throw new ConflictException({
          code: 'NOTHING_TO_PUBLISH',
          message: 'No draft content to publish',
        })
      }

      // Validate content again at publish time.
      const validation = validateBlockContent(input.blockKey, doc.draft)
      if (!validation.success) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Invalid block content',
          details: validation.errors,
        })
      }

      // For featuredTeas, verify product references exist and are published.
      if (input.blockKey === 'home.featuredTeas') {
        await this.validateFeaturedTeas(doc.draft, session)
      }

      const nextPublishedVersion = doc.publishedVersion + 1
      await this.replaceImageUsage(doc.published, validation.data, session)
      const revisionImage = this.imageId(validation.data)
      if (revisionImage) {
        await this.mediaAssetsService.incrementUsageFor([revisionImage], session)
      }

      await this.revisionsRepository.createOne(
        {
          pageKey: input.pageKey,
          blockKey: input.blockKey,
          version: nextPublishedVersion,
          content: validation.data,
          publishedBy: input.actorId ?? null,
        },
        session
      )

      const updated = await this.blocksRepository.updateByKeys(
        input.pageKey,
        input.blockKey,
        {
          published: validation.data,
          publishedVersion: nextPublishedVersion,
          updatedBy: input.actorId ?? null,
        },
        session,
        doc.draftVersion,
        doc.publishedVersion
      )

      if (!updated) {
        throw new ConflictException({
          code: 'CONCURRENT_UPDATE',
          message: 'Block was modified concurrently, please retry',
        })
      }

      await this.auditService.record(
        {
          actorId: input.actorId ?? null,
          action: 'cms.block.published',
          entityType: 'cms-block',
          entityId: `${input.pageKey}.${input.blockKey}`,
          changes: { blockKey: input.blockKey, publishedVersion: nextPublishedVersion },
        },
        session
      )

      return toCmsBlockView(updated)
    })
  }

  // ---- Admin: list revisions ----

  async listRevisions(
    pageKey: string,
    blockKey: CmsBlockKey,
    page: number,
    limit: number
  ): Promise<CmsRevisionList> {
    requireBlock(pageKey, blockKey)
    return this.revisionsRepository.listByBlock(pageKey, blockKey, page, limit)
  }

  // ---- Admin: restore revision to draft ----

  async restoreRevision(input: RestoreCmsRevisionInput): Promise<CmsBlockView> {
    requireBlock(input.pageKey, input.blockKey)
    return this.runInTransaction(async (session) => {
      const revision = await this.revisionsRepository.findById(input.revisionId, session)
      if (!revision) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Revision not found' })
      }

      if (revision.pageKey !== input.pageKey || revision.blockKey !== input.blockKey) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Revision does not belong to this block',
        })
      }

      const doc = await this.blocksRepository.findByKeys(input.pageKey, input.blockKey, session)
      if (!doc) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'CMS block not found' })
      }

      // Restore changes only the draft; published content is untouched.
      const nextDraftVersion = doc.draftVersion + 1
      await this.replaceImageUsage(doc.draft, revision.content, session)
      const updated = await this.blocksRepository.updateByKeys(
        input.pageKey,
        input.blockKey,
        {
          draft: revision.content,
          draftVersion: nextDraftVersion,
          updatedBy: input.actorId ?? null,
        },
        session,
        doc.draftVersion
      )

      if (!updated) {
        throw new ConflictException({
          code: 'CONCURRENT_UPDATE',
          message: 'Block was modified concurrently, please retry',
        })
      }

      await this.auditService.record(
        {
          actorId: input.actorId ?? null,
          action: 'cms.revision.restored',
          entityType: 'cms-block',
          entityId: `${input.pageKey}.${input.blockKey}`,
          changes: {
            revisionId: input.revisionId,
            restoredVersion: revision.version,
            draftVersion: nextDraftVersion,
          },
        },
        session
      )

      return toCmsBlockView(updated)
    })
  }

  // ---- Authorized preview: draft of selected block + published others ----

  async previewPage(pageKey: string, blockKey: CmsBlockKey): Promise<CmsPagePreview> {
    requireBlock(pageKey, blockKey)
    const blocksForPage = CMS_BLOCK_KEYS_FOR_PAGE[pageKey] ?? []
    const blocks: Record<string, Record<string, unknown> | null> = {}

    for (const bk of blocksForPage) {
      const doc = await this.blocksRepository.findByKeys(pageKey, bk)

      if (bk === blockKey) {
        // Use draft if available, otherwise fall back to published.
        blocks[bk] = doc?.draft ?? doc?.published ?? null
      } else {
        blocks[bk] = doc?.published ?? null
      }
    }

    return { pageKey, blocks }
  }

  private async validateFeaturedTeas(
    draft: Record<string, unknown>,
    session: ClientSession
  ): Promise<void> {
    const teaIds = draft.teaIds

    if (!Array.isArray(teaIds) || teaIds.length === 0 || teaIds.length > 4) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'featuredTeas must contain 1 to 4 product IDs',
      })
    }

    for (const teaId of teaIds) {
      if (typeof teaId !== 'string' || !Types.ObjectId.isValid(teaId)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `Invalid product ID: ${teaId}`,
        })
      }

      const card = await this.productsService.lockPublishedForFeature(teaId, session)
      if (!card) {
        throw new ConflictException({
          code: 'PRODUCT_NOT_PUBLISHED',
          message: `Product ${teaId} is not published`,
        })
      }
    }
  }
}

// Block keys per page. Only blocks defined here may exist on each page.
const CMS_BLOCK_KEYS_FOR_PAGE: Record<string, CmsBlockKey[]> = {
  home: ['home.hero', 'home.testimonials', 'home.featuredTeas', 'home.visitStore'],
  catalog: ['catalog.header'],
  about: ['about.content'],
  contacts: ['contacts.content'],
}
