import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectConnection } from '@nestjs/mongoose'
import { ConfigService } from '@nestjs/config'
import { randomBytes } from 'node:crypto'
import { Types } from 'mongoose'
import type { ClientSession, Connection } from 'mongoose'
import { AdminUserRepository } from './admin-user.repository.js'
import { AdminSessionRepository } from './admin-session.repository.js'
import { AuditService } from '../audit/audit.service.js'
import { hashPassword, encodeCredential, normalizeEmail, validatePassword } from './password.js'
import { AdminUser } from './schemas/admin-user.schema.js'
import type { AdminUserDocument } from './schemas/admin-user.schema.js'

// Default lifetime of a temporary password issued on create or reset.
const DEFAULT_TEMPORARY_PASSWORD_TTL_HOURS = 24

// Bytes of randomness used to generate a temporary password.
const TEMPORARY_PASSWORD_BYTES = 24

function temporaryPasswordExpiryHours(config: ConfigService): number {
  const value = Number(config.get('TEMPORARY_PASSWORD_TTL_HOURS'))
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_TEMPORARY_PASSWORD_TTL_HOURS
}

function generateTemporaryPassword(): string {
  return randomBytes(TEMPORARY_PASSWORD_BYTES).toString('hex')
}

function validateNewPassword(password: string, config: ConfigService): void {
  validatePassword(
    password,
    Number.isInteger(Number(config.get('PASSWORD_MIN_LENGTH'))) && Number(config.get('PASSWORD_MIN_LENGTH')) > 0
      ? Number(config.get('PASSWORD_MIN_LENGTH'))
      : 8,
    Number.isInteger(Number(config.get('PASSWORD_MAX_LENGTH'))) && Number(config.get('PASSWORD_MAX_LENGTH')) > 0
      ? Number(config.get('PASSWORD_MAX_LENGTH'))
      : 128,
  )
}

function toSafeUser(user: AdminUserDocument) {
  return {
    id: String(user._id),
    email: user.normalizedEmail,
    displayName: user.displayName,
    isActive: user.isActive === true,
    mustChangePassword: user.mustChangePassword === true,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt ?? null,
  }
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly adminUserRepository: AdminUserRepository,
    private readonly adminSessionRepository: AdminSessionRepository,
    private readonly auditService: AuditService,
    @InjectConnection() private readonly connection: Connection,
    private readonly config: ConfigService,
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

  private async withAdminMutationLock<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
    await this.adminUserRepository.initializeMutationGuard()
    return this.runInTransaction(async (session) => {
      await this.adminUserRepository.acquireMutationGuard(session)
      return work(session)
    })
  }

  async listUsers(
    page: number,
    limit: number,
    search?: string,
  ): Promise<{ items: AdminUserDocument[]; totalItems: number }> {
    const { docs, totalItems } = await this.adminUserRepository.listAdmin(page, limit, search)

    return { items: docs, totalItems }
  }

  async createUser(
    email: unknown,
    displayName: unknown,
    actorId: string | null,
    password?: string,
  ): Promise<{
    user: ReturnType<typeof toSafeUser>
    temporaryPassword?: string
    temporaryPasswordExpiresAt?: Date
  }> {
    const normalizedEmail = normalizeEmail(email)
    const name =
      typeof displayName === 'string' && displayName.trim().length > 0 ? displayName.trim() : ''

    if (name.length === 0) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'displayName is required' })
    }

    return this.runInTransaction(async (session) => {
      const existing = await this.adminUserRepository.findByNormalizedEmail(normalizedEmail, session)

      if (existing) {
        throw new ConflictException({ code: 'CONFLICT', message: 'Email address is already in use' })
      }

      let passwordHash: string
      let mustChangePassword: boolean
      let temporaryPassword: string | undefined
      let temporaryPasswordExpiresAt: Date | undefined

      if (typeof password === 'string' && password.length > 0) {
        // The caller supplied the password directly (for example the initial
        // administrator via `admin:create`). Hash it and mark the account as
        // ready to use; no temporary password is issued.
        try {
          validateNewPassword(password, this.config)
        } catch (error) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: (error as Error).message,
          })
        }
        const { hash, salt } = hashPassword(password)
        passwordHash = encodeCredential(hash, salt)
        mustChangePassword = false
      } else {
        // Another administrator creates an account: issue a server-generated
        // temporary password that must be changed on first sign-in.
        temporaryPassword = generateTemporaryPassword()
        const { hash, salt } = hashPassword(temporaryPassword)
        passwordHash = encodeCredential(hash, salt)
        mustChangePassword = true
        temporaryPasswordExpiresAt = new Date(
          Date.now() + temporaryPasswordExpiryHours(this.config) * 60 * 60 * 1000,
        )
      }

      const userId = new Types.ObjectId()

      const created = await this.adminUserRepository.create(
        {
          _id: userId,
          email: normalizedEmail,
          normalizedEmail,
          displayName: name,
          passwordHash,
          mustChangePassword,
          temporaryPasswordExpiresAt: temporaryPasswordExpiresAt ?? null,
          isActive: true,
          createdBy: actorId ? new Types.ObjectId(actorId) : null,
          lastLoginAt: null,
        } as unknown as AdminUser,
        session,
      )

      await this.auditService.record(
        {
          actorId,
          action: 'admin-user.created',
          entityType: 'admin-user',
          entityId: String(userId),
          changes: { email: normalizedEmail, displayName: name, isActive: true },
        },
        session,
      )

      return {
        user: toSafeUser(created),
        temporaryPassword,
        temporaryPasswordExpiresAt,
      }
    })
  }

  async updateUser(
    id: string,
    dto: { displayName?: unknown; isActive?: unknown },
    actorId: string | null,
  ): Promise<ReturnType<typeof toSafeUser>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'userId must be a valid ObjectId' })
    }

    const hasDisplayName = dto.displayName !== undefined
    const hasIsActive = dto.isActive !== undefined

    if (!hasDisplayName && !hasIsActive) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Request body is empty' })
    }

    if (hasIsActive && typeof dto.isActive !== 'boolean') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'isActive must be a boolean',
      })
    }

    return this.withAdminMutationLock(async (session) => {
      const user = await this.adminUserRepository.findById(id, session)

      if (!user) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Administrator not found' })
      }

      const changes: Record<string, unknown> = {}

      if (hasDisplayName) {
        const name = typeof dto.displayName === 'string' ? dto.displayName.trim() : ''
        if (name.length === 0) {
          throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'displayName must be a string' })
        }
        if (name !== user.displayName) {
          user.displayName = name
          changes.displayName = name
        }
      }

      if (hasIsActive && dto.isActive !== user.isActive) {
        if (dto.isActive === false) {
          if (actorId && user._id.equals(actorId)) {
            throw new ForbiddenException({
              code: 'FORBIDDEN',
              message: 'Administrator cannot deactivate themself',
            })
          }

          // The shared write guard serializes this check with competing
          // deactivations, including after a transaction retry.
          const activeOthers = await this.adminUserRepository.countActiveExcluding(
            session,
            user._id,
          )
          if (activeOthers === 0) {
            throw new ForbiddenException({
              code: 'FORBIDDEN',
              message: 'Cannot deactivate the last active administrator',
            })
          }

          user.isActive = false
          changes.isActive = false
          await this.adminSessionRepository.revokeAllForUser(user._id, session)
        } else {
          user.isActive = true
          changes.isActive = true
        }
      }

      if (Object.keys(changes).length > 0) {
        await this.adminUserRepository.save(user, session)

        await this.auditService.record(
          {
            actorId,
            action: 'admin-user.updated',
            entityType: 'admin-user',
            entityId: id,
            changes,
          },
          session,
        )
      }

      return toSafeUser(user)
    })
  }

  async resetPassword(
    id: string,
    actorId: string | null,
  ): Promise<{
    user: ReturnType<typeof toSafeUser>
    temporaryPassword: string
    temporaryPasswordExpiresAt: Date
  }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'userId must be a valid ObjectId' })
    }

    return this.runInTransaction(async (session) => {
      const user = await this.adminUserRepository.findById(id, session)

      if (!user) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Administrator not found' })
      }

      const temporaryPassword = generateTemporaryPassword()
      const { hash, salt } = hashPassword(temporaryPassword)
      const expiresAt = new Date(
        Date.now() + temporaryPasswordExpiryHours(this.config) * 60 * 60 * 1000,
      )

      user.passwordHash = encodeCredential(hash, salt)
      user.mustChangePassword = true
      user.temporaryPasswordExpiresAt = expiresAt
      user.lastLoginAt = null

      await this.adminUserRepository.save(user, session)

      // A password reset revokes every session so the user must sign in again.
      await this.adminSessionRepository.revokeAllForUser(user._id, session)

      await this.auditService.record(
        {
          actorId,
          action: 'admin-user.password-reset',
          entityType: 'admin-user',
          entityId: id,
          changes: { mustChangePassword: true, temporaryPasswordExpiresAt: expiresAt.toISOString() },
        },
        session,
      )

      return {
        user: toSafeUser(user),
        temporaryPassword,
        temporaryPasswordExpiresAt: expiresAt,
      }
    })
  }

  async revokeSessions(id: string, actorId: string | null): Promise<{ revokedCount: number }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'userId must be a valid ObjectId' })
    }

    return this.runInTransaction(async (session) => {
      const user = await this.adminUserRepository.findById(id, session)

      if (!user) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Administrator not found' })
      }

      const revokedCount = await this.adminSessionRepository.revokeAllForUser(user._id, session)

      await this.auditService.record(
        {
          actorId,
          action: 'admin-user.sessions-revoked',
          entityType: 'admin-user',
          entityId: id,
          changes: { revokedCount },
        },
        session,
      )

      return { revokedCount }
    })
  }
}
