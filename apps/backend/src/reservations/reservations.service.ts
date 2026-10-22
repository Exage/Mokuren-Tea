import type { ReservationEventView } from './reservations.types.js'
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
import { InventoryService } from '../inventory/inventory.service.js'
import { InventoryMovementsService } from '../inventory-movements/inventory-movements.service.js'
import { AuditService } from '../audit/audit.service.js'
import { IdempotencyService } from '../idempotency/idempotency.service.js'
import { ReservationsRepository } from './reservations.repository.js'
import { ReservationEventsRepository } from './reservation-events.repository.js'
import type { ReservationDocument } from './schemas/reservation.schema.js'
import type {
  ActiveReservationsOverview,
  ReservationStatus,
  ReservationLineInput,
  CreateReservationInput,
  ReservationView,
  ReservationList,
  ReservationFilters,
} from './reservations.types.js'
import { toProductPrice } from '../products/domain/product-price.js'

function requirePositiveInt(value: unknown, field: string): number {
  const n = value as number
  if (!Number.isInteger(n) || n <= 0) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `${field} must be a positive integer`,
    })
  }
  return n
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `${field} is required`,
    })
  }
  return value.trim()
}

function moneyToCents(value: number | string): bigint {
  const text = typeof value === 'number' ? toProductPrice(value).toString() : value
  const [whole, fraction = ''] = text.split('.')
  if (!whole || !/^\d+$/.test(whole) || !/^\d{0,2}$/.test(fraction)) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Invalid money amount' })
  }
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}

function formatMoney(cents: bigint): string {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
}

const RESERVATION_NUMBER_PREFIX = 'MT-'
const RESERVATION_NUMBER_WIDTH = 6

function formatReservationNumber(seq: number): string {
  return `${RESERVATION_NUMBER_PREFIX}${String(seq).padStart(RESERVATION_NUMBER_WIDTH, '0')}`
}

interface ResolvedLine {
  productId: Types.ObjectId
  productName: string
  variantId: string
  variantWeightGrams: number
  variantPriceCents: bigint
  quantity: number
  lineTotalCents: bigint
  grams: number
}

@Injectable()
export class ReservationsService {
  constructor(
    private readonly productsService: ProductsService,
    private readonly inventoryService: InventoryService,
    private readonly inventoryMovementsService: InventoryMovementsService,
    private readonly reservationsRepository: ReservationsRepository,
    private readonly reservationEventsRepository: ReservationEventsRepository,
    private readonly auditService: AuditService,
    private readonly idempotencyService: IdempotencyService,
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
          message: 'Reservation changed concurrently',
        })
      }
      throw error
    } finally {
      await session.endSession()
    }
  }

  // ---- Public creation ----

  async createPublic(
    input: CreateReservationInput,
    idempotencyKey: string | null
  ): Promise<ReservationView> {
    if (input.source !== 'website' && input.source !== 'admin') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'source must be website or admin',
      })
    }

    if (!input.lines || input.lines.length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'At least one reservation line is required',
      })
    }

    const customerName = requireNonEmptyString(input.customerName, 'customerName')
    const customerPhone = requireNonEmptyString(input.customerPhone, 'customerPhone')

    const idempotencyOptions = idempotencyKey
      ? {
          key: idempotencyKey,
          operation: 'reservation.create',
          contentHash: await this.idempotencyService.computeHash({
            operation: 'reservation.create',
            source: input.source,
            customerName,
            customerPhone,
            lines: input.lines,
          }),
        }
      : null
    if (idempotencyOptions) {
      const previous = await this.idempotencyService.lookup(idempotencyOptions)
      if (previous?.resultPayload) {
        return previous.resultPayload as unknown as ReservationView
      }
    }

    const combined = this.combineLines(input.lines)
    const resolved = await this.resolveLinesForCreation(combined)
    await this.checkAvailability(resolved)

    let totalGrams = 0
    let totalAmount = 0n
    const lines: Array<{
      productId: string
      productName: string
      variantId: string
      variantWeightGrams: number
      variantPrice: string
      quantity: number
      lineTotal: string
      grams: number
    }> = []

    for (const line of resolved) {
      totalGrams += line.grams
      totalAmount += line.lineTotalCents
      lines.push({
        productId: String(line.productId),
        productName: line.productName,
        variantId: line.variantId,
        variantWeightGrams: line.variantWeightGrams,
        variantPrice: formatMoney(line.variantPriceCents),
        quantity: line.quantity,
        lineTotal: formatMoney(line.lineTotalCents),
        grams: line.grams,
      })
    }

    const totalAmountStr = formatMoney(totalAmount)

    let claimed = false
    let replay: { resultId: string | null; resultPayload: Record<string, unknown> | null } | null =
      null

    if (idempotencyOptions) {
      const outcome = await this.idempotencyService.claim(idempotencyOptions)
      claimed = outcome.claimed
      replay = outcome.replay
    }

    if (!claimed && replay) {
      const payload = replay.resultPayload as unknown as ReservationView | null
      if (payload) {
        return payload
      }
      throw new BadRequestException({
        code: 'IDEMPOTENCY_REPLAY_INVALID',
        message: 'Stored idempotency result is invalid',
      })
    }

    try {
      // Allocate outside the business transaction so a rollback never reuses
      // a number. The claim is abandoned if allocation itself fails.
      const sequence = await this.reservationsRepository.allocateNumberSequence()
      const number = formatReservationNumber(sequence)

      return await this.runInTransaction(async (session) => {
        const doc = await this.reservationsRepository.createOne(
          {
            number,
            source: input.source,
            customerName,
            customerPhone,
            status: 'new',
            lines: lines.map((line) => ({
              productId: new Types.ObjectId(line.productId),
              productName: line.productName,
              variantId: line.variantId,
              variantWeightGrams: line.variantWeightGrams,
              variantPrice: line.variantPrice,
              quantity: line.quantity,
              lineTotal: line.lineTotal,
              grams: line.grams,
            })),
            totalGrams,
            totalAmount: totalAmountStr,
            createdByAdminId: input.actorId ? new Types.ObjectId(input.actorId) : null,
          },
          session
        )

        await this.reservationEventsRepository.createOne(
          {
            reservationId: doc._id as Types.ObjectId,
            action: 'created',
            newStatus: 'new',
            changes: {
              customerName,
              customerPhone,
              totalGrams,
              totalAmount: totalAmountStr,
              lineCount: lines.length,
            },
            actorId: input.actorId ?? null,
          },
          session
        )

        await this.auditService.record(
          {
            actorId: input.actorId ?? null,
            action: 'reservation.created',
            entityType: 'reservation',
            entityId: String(doc._id),
            changes: { number, totalGrams, totalAmount: totalAmountStr },
          },
          session
        )

        if (idempotencyKey && claimed) {
          const view = this.reservationsRepository.toView(doc)
          await this.idempotencyService.complete(
            idempotencyKey,
            String(doc._id),
            view as unknown as Record<string, unknown>,
            session
          )
        }

        return this.reservationsRepository.toView(doc)
      })
    } catch (error) {
      if (idempotencyKey && claimed) {
        await this.idempotencyService.abandon(idempotencyKey)
      }
      throw error
    }
  }

  private combineLines(lines: ReservationLineInput[]): ReservationLineInput[] {
    const map = new Map<string, ReservationLineInput>()
    for (const line of lines) {
      const key = `${line.productId}|${line.variantId}`
      const existing = map.get(key)
      if (existing) {
        existing.quantity += line.quantity
      } else {
        map.set(key, { ...line })
      }
    }
    return Array.from(map.values())
  }

  private async resolveLinesForCreation(lines: ReservationLineInput[]): Promise<ResolvedLine[]> {
    const resolved: ResolvedLine[] = []

    for (const line of lines) {
      const quantity = requirePositiveInt(line.quantity, 'quantity')

      const card = await this.productsService.getAdminCard(line.productId)

      if (card.status !== 'published') {
        throw new ConflictException({
          code: 'PRODUCT_NOT_PUBLISHED',
          message: `Product ${card.name} is not published`,
        })
      }

      const variant = card.variants.find((v) => v.variantId === line.variantId)
      if (!variant) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: `Variant ${line.variantId} not found on product ${card.name}`,
        })
      }

      if (!variant.enabled) {
        throw new ConflictException({
          code: 'VARIANT_DISABLED',
          message: `Variant ${line.variantId} of product ${card.name} is not available`,
        })
      }

      if (!Number.isInteger(variant.weightGrams) || variant.weightGrams <= 0) {
        throw new ConflictException({
          code: 'INVALID_VARIANT_WEIGHT',
          message: `Variant ${line.variantId} has invalid weight`,
        })
      }

      const variantPriceCents = moneyToCents(variant.price)
      const lineTotalCents = variantPriceCents * BigInt(quantity)
      const grams = variant.weightGrams * quantity
      if (!Number.isSafeInteger(grams)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Quantity is too large',
        })
      }

      resolved.push({
        productId: new Types.ObjectId(line.productId),
        productName: card.name,
        variantId: line.variantId,
        variantWeightGrams: variant.weightGrams,
        variantPriceCents,
        quantity,
        lineTotalCents,
        grams,
      })
    }

    return resolved
  }

  private async checkAvailability(resolved: ResolvedLine[]): Promise<void> {
    const requiredByProduct = new Map<
      string,
      { productId: Types.ObjectId; requiredGrams: number }
    >()

    for (const line of resolved) {
      const key = String(line.productId)
      const existing = requiredByProduct.get(key)
      if (existing) {
        existing.requiredGrams += line.grams
      } else {
        requiredByProduct.set(key, { productId: line.productId, requiredGrams: line.grams })
      }
    }

    const productIds = Array.from(requiredByProduct.values()).map((e) => e.productId)
    const stocks = await this.inventoryService.getStockForMany(productIds)

    for (const entry of requiredByProduct.values()) {
      const stock = stocks.get(String(entry.productId))
      const available = stock ? stock.physicalGrams - stock.reservedGrams : 0
      if (available < entry.requiredGrams) {
        throw new ConflictException({
          code: 'INSUFFICIENT_STOCK',
          message: `Not enough stock for product ${entry.productId}`,
        })
      }
    }
  }

  // ---- Admin read ----

  async getReservation(id: string): Promise<ReservationView> {
    const doc = await this.reservationsRepository.findById(id)
    if (!doc) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Reservation not found' })
    }
    return this.reservationsRepository.toView(doc)
  }

  getActiveOverview(): Promise<ActiveReservationsOverview> {
    return this.reservationsRepository.getActiveOverview()
  }

  async listReservations(filters: ReservationFilters): Promise<ReservationList> {
    return this.reservationsRepository.list(filters)
  }

  async listReservationEvents(reservationId: string): Promise<ReservationEventView[]> {
    const doc = await this.reservationsRepository.findById(reservationId)
    if (!doc) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Reservation not found' })
    }
    return this.reservationEventsRepository.listByReservation(reservationId)
  }

  // ---- Admin edit (only 'new') ----

  async updateReservation(
    id: string,
    input: { lines?: ReservationLineInput[]; customerName?: string; customerPhone?: string },
    actorId: string | null
  ): Promise<ReservationView> {
    return this.runInTransaction(async (session) => {
      const doc = await this.reservationsRepository.findById(id, session)
      if (!doc) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Reservation not found' })
      }

      if (doc.status !== 'new') {
        throw new ConflictException({
          code: 'INVALID_STATUS_TRANSITION',
          message: 'Only reservations in new status can be edited',
        })
      }

      const changes: Record<string, unknown> = {}

      if (input.customerName !== undefined) {
        const name = requireNonEmptyString(input.customerName, 'customerName')
        if (name !== doc.customerName) {
          doc.customerName = name
          changes.customerName = name
        }
      }

      if (input.customerPhone !== undefined) {
        const phone = requireNonEmptyString(input.customerPhone, 'customerPhone')
        if (phone !== doc.customerPhone) {
          doc.customerPhone = phone
          changes.customerPhone = phone
        }
      }

      let linesChanged = false
      const newLines: Array<{
        productId: string
        productName: string
        variantId: string
        variantWeightGrams: number
        variantPrice: string
        quantity: number
        lineTotal: string
        grams: number
      }> = []
      let newTotalGrams = 0
      let newTotalAmount = 0n

      if (input.lines !== undefined) {
        if (input.lines.length === 0) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: 'At least one reservation line is required',
          })
        }

        const combined = this.combineLines(input.lines)
        const resolved: ResolvedLine[] = []
        for (const requested of combined) {
          const unchanged = doc.lines.find(
            (line) =>
              String(line.productId) === requested.productId &&
              line.variantId === requested.variantId &&
              line.quantity === requested.quantity
          )
          if (unchanged) {
            const variantPriceCents = moneyToCents(unchanged.variantPrice.toString())
            resolved.push({
              productId: new Types.ObjectId(requested.productId),
              productName: unchanged.productName,
              variantId: unchanged.variantId,
              variantWeightGrams: unchanged.variantWeightGrams,
              variantPriceCents,
              quantity: unchanged.quantity,
              lineTotalCents: moneyToCents(unchanged.lineTotal.toString()),
              grams: unchanged.variantWeightGrams * unchanged.quantity,
            })
          } else {
            resolved.push(...(await this.resolveLinesForCreation([requested])))
          }
        }
        await this.checkAvailability(resolved)

        for (const line of resolved) {
          newTotalGrams += line.grams
          newTotalAmount += line.lineTotalCents
          newLines.push({
            productId: String(line.productId),
            productName: line.productName,
            variantId: line.variantId,
            variantWeightGrams: line.variantWeightGrams,
            variantPrice: formatMoney(line.variantPriceCents),
            quantity: line.quantity,
            lineTotal: formatMoney(line.lineTotalCents),
            grams: line.grams,
          })
        }

        linesChanged = true
      }

      if (linesChanged) {
        const oldLines = doc.lines.map((line) => ({
          productId: String(line.productId),
          productName: line.productName,
          variantId: line.variantId,
          variantWeightGrams: line.variantWeightGrams,
          variantPrice: line.variantPrice.toString(),
          quantity: line.quantity,
          lineTotal: line.lineTotal.toString(),
        }))
        doc.lines = newLines.map((line) => ({
          productId: new Types.ObjectId(line.productId),
          productName: line.productName,
          variantId: line.variantId,
          variantWeightGrams: line.variantWeightGrams,
          variantPrice: Types.Decimal128.fromString(line.variantPrice),
          quantity: line.quantity,
          lineTotal: Types.Decimal128.fromString(line.lineTotal),
          grams: line.grams,
        }))
        doc.totalGrams = newTotalGrams
        doc.totalAmount = Types.Decimal128.fromString(formatMoney(newTotalAmount))
        changes.lines = { before: oldLines, after: newLines }
        changes.totalGrams = newTotalGrams
        changes.totalAmount = formatMoney(newTotalAmount)
      }

      if (Object.keys(changes).length > 0) {
        await this.reservationsRepository.save(doc, session)

        await this.reservationEventsRepository.createOne(
          {
            reservationId: doc._id as Types.ObjectId,
            action: 'edited',
            changes,
            actorId,
          },
          session
        )

        await this.auditService.record(
          {
            actorId,
            action: 'reservation.edited',
            entityType: 'reservation',
            entityId: id,
            changes: {
              fields: Object.keys(changes),
              totalGrams: doc.totalGrams,
              totalAmount: doc.totalAmount.toString(),
            },
          },
          session
        )
      }

      return this.reservationsRepository.toView(doc)
    })
  }

  // ---- Status transitions ----

  private static readonly ALLOWED_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
    new: ['confirmed', 'cancelled'],
    confirmed: ['ready', 'cancelled'],
    ready: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  }

  private async transitionStatus(
    id: string,
    newStatus: ReservationStatus,
    actorId: string | null,
    extraWork: (session: ClientSession, doc: ReservationDocument) => Promise<void>
  ): Promise<ReservationView> {
    return this.runInTransaction(async (session) => {
      const doc = await this.reservationsRepository.findById(id, session)
      if (!doc) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Reservation not found' })
      }

      const oldStatus = doc.status
      const allowed = ReservationsService.ALLOWED_TRANSITIONS[oldStatus]
      if (!allowed || !allowed.includes(newStatus)) {
        throw new ConflictException({
          code: 'INVALID_STATUS_TRANSITION',
          message: `Cannot transition from ${oldStatus} to ${newStatus}`,
        })
      }

      await extraWork(session, doc)

      const previousStatus = doc.status
      doc.status = newStatus
      await this.reservationsRepository.save(doc, session)

      await this.reservationEventsRepository.createOne(
        {
          reservationId: doc._id as Types.ObjectId,
          action: 'status-changed',
          oldStatus: previousStatus,
          newStatus,
          changes: { previousStatus, newStatus },
          actorId,
        },
        session
      )

      await this.auditService.record(
        {
          actorId,
          action: `reservation.${newStatus}`,
          entityType: 'reservation',
          entityId: id,
          changes: { previousStatus, newStatus },
        },
        session
      )

      return this.reservationsRepository.toView(doc)
    })
  }

  // Confirm: atomically check stock and reserve grams.
  async confirm(id: string, actorId: string | null): Promise<ReservationView> {
    return this.transitionStatus(id, 'confirmed', actorId, async (session, doc) => {
      const requiredByProduct = new Map<
        string,
        { productId: Types.ObjectId; requiredGrams: number }
      >()
      for (const line of doc.lines) {
        const key = String(line.productId)
        const grams = line.variantWeightGrams * line.quantity
        const existing = requiredByProduct.get(key)
        if (existing) {
          existing.requiredGrams += grams
        } else {
          requiredByProduct.set(key, {
            productId: line.productId as Types.ObjectId,
            requiredGrams: grams,
          })
        }
      }

      const productIds = Array.from(requiredByProduct.values()).map((e) => e.productId)
      const stocks = await this.inventoryService.getStockForMany(productIds, session)

      for (const entry of requiredByProduct.values()) {
        const stock = stocks.get(String(entry.productId))
        const available = stock ? stock.physicalGrams - stock.reservedGrams : 0
        if (available < entry.requiredGrams) {
          throw new ConflictException({
            code: 'INSUFFICIENT_STOCK',
            message: `Not enough stock for product ${entry.productId}`,
          })
        }
      }

      for (const entry of requiredByProduct.values()) {
        const stock = stocks.get(String(entry.productId))!
        const updated = await this.inventoryService.applyDelta(
          entry.productId,
          0,
          entry.requiredGrams,
          session
        )
        if (!updated) {
          throw new ConflictException({
            code: 'CONCURRENT_UPDATE',
            message: 'Stock changed concurrently, please retry',
          })
        }

        await this.inventoryMovementsService.recordMovementDirectly(
          entry.productId,
          'reserve',
          { physicalGrams: stock.physicalGrams, reservedGrams: stock.reservedGrams },
          { physicalGrams: 0, reservedGrams: entry.requiredGrams },
          {
            physicalGrams: stock.physicalGrams,
            reservedGrams: stock.reservedGrams + entry.requiredGrams,
          },
          null,
          new Types.ObjectId(String(doc._id)),
          null,
          actorId,
          session
        )
      }
    })
  }

  // Ready: no stock change.
  async ready(id: string, actorId: string | null): Promise<ReservationView> {
    return this.transitionStatus(id, 'ready', actorId, async () => {
      // No stock change at ready.
    })
  }

  // Complete / write-off: decrease physical and reserved by same amount.
  async complete(id: string, actorId: string | null): Promise<ReservationView> {
    return this.transitionStatus(id, 'completed', actorId, async (session, doc) => {
      const requiredByProduct = new Map<
        string,
        { productId: Types.ObjectId; requiredGrams: number }
      >()
      for (const line of doc.lines) {
        const key = String(line.productId)
        const grams = line.variantWeightGrams * line.quantity
        const existing = requiredByProduct.get(key)
        if (existing) {
          existing.requiredGrams += grams
        } else {
          requiredByProduct.set(key, {
            productId: line.productId as Types.ObjectId,
            requiredGrams: grams,
          })
        }
      }

      const productIds = Array.from(requiredByProduct.values()).map((e) => e.productId)
      const stocks = await this.inventoryService.getStockForMany(productIds, session)

      for (const entry of requiredByProduct.values()) {
        const stock = stocks.get(String(entry.productId))
        const reserved = stock ? stock.reservedGrams : 0
        if (reserved < entry.requiredGrams) {
          throw new ConflictException({
            code: 'INSUFFICIENT_RESERVED',
            message: `Not enough reserved stock for product ${entry.productId}`,
          })
        }

        const updated = await this.inventoryService.applyDelta(
          entry.productId,
          -entry.requiredGrams,
          -entry.requiredGrams,
          session
        )
        if (!updated) {
          throw new ConflictException({
            code: 'CONCURRENT_UPDATE',
            message: 'Stock changed concurrently, please retry',
          })
        }

        await this.inventoryMovementsService.recordMovementDirectly(
          entry.productId,
          'complete',
          { physicalGrams: stock!.physicalGrams, reservedGrams: stock!.reservedGrams },
          { physicalGrams: -entry.requiredGrams, reservedGrams: -entry.requiredGrams },
          {
            physicalGrams: stock!.physicalGrams - entry.requiredGrams,
            reservedGrams: stock!.reservedGrams - entry.requiredGrams,
          },
          null,
          new Types.ObjectId(String(doc._id)),
          null,
          actorId,
          session
        )
      }
    })
  }

  // Cancel: release reserved grams depending on status.
  async cancel(
    id: string,
    actorId: string | null,
    teaReturned: boolean = false
  ): Promise<ReservationView> {
    return this.transitionStatus(id, 'cancelled', actorId, async (session, doc) => {
      if (doc.status === 'new') {
        return
      }

      if (doc.status === 'confirmed') {
        const requiredByProduct = new Map<
          string,
          { productId: Types.ObjectId; requiredGrams: number }
        >()
        for (const line of doc.lines) {
          const key = String(line.productId)
          const grams = line.variantWeightGrams * line.quantity
          const existing = requiredByProduct.get(key)
          if (existing) {
            existing.requiredGrams += grams
          } else {
            requiredByProduct.set(key, {
              productId: line.productId as Types.ObjectId,
              requiredGrams: grams,
            })
          }
        }

        const productIds = Array.from(requiredByProduct.values()).map((e) => e.productId)
        const stocks = await this.inventoryService.getStockForMany(productIds, session)

        for (const entry of requiredByProduct.values()) {
          const stock = stocks.get(String(entry.productId))
          const updated = await this.inventoryService.applyDelta(
            entry.productId,
            0,
            -entry.requiredGrams,
            session
          )
          if (!updated) {
            throw new ConflictException({
              code: 'CONCURRENT_UPDATE',
              message: 'Stock changed concurrently, please retry',
            })
          }

          await this.inventoryMovementsService.recordMovementDirectly(
            entry.productId,
            'release',
            { physicalGrams: stock!.physicalGrams, reservedGrams: stock!.reservedGrams },
            { physicalGrams: 0, reservedGrams: -entry.requiredGrams },
            {
              physicalGrams: stock!.physicalGrams,
              reservedGrams: stock!.reservedGrams - entry.requiredGrams,
            },
            null,
            new Types.ObjectId(String(doc._id)),
            null,
            actorId,
            session
          )
        }
        return
      }

      if (doc.status === 'ready') {
        if (!teaReturned) {
          throw new ConflictException({
            code: 'TEA_NOT_RETURNED',
            message: 'Cancelling a ready reservation requires confirmation that tea was returned',
          })
        }

        const requiredByProduct = new Map<
          string,
          { productId: Types.ObjectId; requiredGrams: number }
        >()
        for (const line of doc.lines) {
          const key = String(line.productId)
          const grams = line.variantWeightGrams * line.quantity
          const existing = requiredByProduct.get(key)
          if (existing) {
            existing.requiredGrams += grams
          } else {
            requiredByProduct.set(key, {
              productId: line.productId as Types.ObjectId,
              requiredGrams: grams,
            })
          }
        }

        const productIds = Array.from(requiredByProduct.values()).map((e) => e.productId)
        const stocks = await this.inventoryService.getStockForMany(productIds, session)

        for (const entry of requiredByProduct.values()) {
          const stock = stocks.get(String(entry.productId))
          const updated = await this.inventoryService.applyDelta(
            entry.productId,
            0,
            -entry.requiredGrams,
            session
          )
          if (!updated) {
            throw new ConflictException({
              code: 'CONCURRENT_UPDATE',
              message: 'Stock changed concurrently, please retry',
            })
          }

          await this.inventoryMovementsService.recordMovementDirectly(
            entry.productId,
            'release',
            { physicalGrams: stock!.physicalGrams, reservedGrams: stock!.reservedGrams },
            { physicalGrams: 0, reservedGrams: -entry.requiredGrams },
            {
              physicalGrams: stock!.physicalGrams,
              reservedGrams: stock!.reservedGrams - entry.requiredGrams,
            },
            null,
            new Types.ObjectId(String(doc._id)),
            null,
            actorId,
            session
          )
        }
      }
    })
  }
}
