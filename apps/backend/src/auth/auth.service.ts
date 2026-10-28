import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common'
import { InjectConnection } from '@nestjs/mongoose'
import { ConfigService } from '@nestjs/config'
import { Types } from 'mongoose'
import type { ClientSession, Connection } from 'mongoose'
import { randomBytes } from 'node:crypto'
import { AdminUserRepository } from './admin-user.repository.js'
import { AdminSessionRepository } from './admin-session.repository.js'
import { AuditService } from '../audit/audit.service.js'
import { hashSessionToken } from './admin-auth.guard.js'
import {
  DEFAULT_PASSWORD_MAX_LENGTH,
  DEFAULT_PASSWORD_MIN_LENGTH,
  encodeCredential,
  hashPassword,
  normalizeLogin,
  parseCredential,
  validatePassword,
  verifyPassword,
} from './password.js'
import type { AdminUserDocument } from './schemas/admin-user.schema.js'

// Session lifetime, derived from configuration so the server-side session and
// the session cookie stay consistent. Defaults to 7 days.
const DEFAULT_SESSION_TTL_DAYS = 7

function sessionTtlMs(config: ConfigService): number {
  const days = Number(config.get('SESSION_TTL_DAYS'))
  return Number.isInteger(days) && days > 0
    ? days * 24 * 60 * 60 * 1000
    : DEFAULT_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
}

function passwordMinLength(config: ConfigService): number {
  const value = Number(config.get('PASSWORD_MIN_LENGTH'))
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_PASSWORD_MIN_LENGTH
}

function passwordMaxLength(config: ConfigService): number {
  const value = Number(config.get('PASSWORD_MAX_LENGTH'))
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_PASSWORD_MAX_LENGTH
}

export interface SafeAdminUser {
  id: string
  login: string
  displayName: string
  mustChangePassword: boolean
}

function invalidCredentials(): never {
  // One generic error for unknown login, wrong password, inactive account, or
  // expired temporary password: the response must not reveal whether an account
  // exists.
  throw new UnauthorizedException({
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid login or password',
  })
}

@Injectable()
export class AuthService {
  constructor(
    private readonly adminUserRepository: AdminUserRepository,
    private readonly adminSessionRepository: AdminSessionRepository,
    private readonly auditService: AuditService,
    @InjectConnection() private readonly connection: Connection,
    private readonly config: ConfigService
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

  private toSafeUser(user: AdminUserDocument): SafeAdminUser {
    return {
      id: String(user._id),
      login: user.normalizedEmail,
      displayName: user.displayName,
      mustChangePassword: user.mustChangePassword === true,
    }
  }

  async login(login: unknown, password: unknown): Promise<{ user: SafeAdminUser; token: string }> {
    let normalizedLogin: string
    try {
      normalizedLogin = normalizeLogin(login)
    } catch {
      invalidCredentials()
    }

    return this.runInTransaction(async (session) => {
      const user = await this.adminUserRepository.findByNormalizedLogin(normalizedLogin, session)

      if (!user || typeof user.passwordHash !== 'string') {
        invalidCredentials()
      }

      const stored = parseCredential(user.passwordHash)
      if (!stored || !verifyPassword(String(password), stored)) {
        invalidCredentials()
      }

      if (user.isActive !== true) {
        invalidCredentials()
      }

      // An expired temporary password cannot be used to authenticate at all.
      if (
        user.mustChangePassword === true &&
        user.temporaryPasswordExpiresAt !== null &&
        user.temporaryPasswordExpiresAt.getTime() <= Date.now()
      ) {
        invalidCredentials()
      }

      const token = await this.createSession(String(user._id), session)

      user.lastLoginAt = new Date()
      await this.adminUserRepository.save(user, session)

      return { user: this.toSafeUser(user), token }
    })
  }

  private async createSession(adminUserId: string, session: ClientSession): Promise<string> {
    const token = randomBytes(32).toString('hex')

    await this.adminSessionRepository.create(
      {
        adminUserId: new Types.ObjectId(adminUserId),
        tokenHash: hashSessionToken(token),
        expiresAt: new Date(Date.now() + sessionTtlMs(this.config)),
        revokedAt: null,
      },
      session
    )

    return token
  }

  async logout(adminUserId: string, tokenHash: string): Promise<void> {
    await this.runInTransaction(async (session) => {
      await this.adminSessionRepository.revoke(tokenHash, session)
      await this.auditService.record(
        {
          actorId: adminUserId,
          action: 'admin-user.logged-out',
          entityType: 'admin-user',
          entityId: adminUserId,
        },
        session
      )
    })
  }

  async getProfile(adminUserId: string): Promise<SafeAdminUser> {
    const user = await this.adminUserRepository.findById(adminUserId)

    if (!user || user.isActive !== true) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Administrator is inactive',
      })
    }

    return this.toSafeUser(user)
  }

  async changePassword(
    adminUserId: string,
    currentPassword: unknown,
    newPassword: unknown
  ): Promise<{ user: SafeAdminUser; token: string }> {
    return this.runInTransaction(async (session) => {
      const user = await this.adminUserRepository.findById(adminUserId, session)

      if (!user || typeof user.passwordHash !== 'string') {
        invalidCredentials()
      }

      const stored = parseCredential(user.passwordHash)
      if (!stored || !verifyPassword(String(currentPassword), stored)) {
        // Wrong current password: generic error, no oracle.
        invalidCredentials()
      }

      const newPasswordString = String(newPassword)
      try {
        validatePassword(
          newPasswordString,
          passwordMinLength(this.config),
          passwordMaxLength(this.config)
        )
      } catch (error) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: (error as Error).message,
        })
      }

      const newStored = hashPassword(newPasswordString)
      user.passwordHash = encodeCredential(newStored.hash, newStored.salt)
      user.mustChangePassword = false
      user.temporaryPasswordExpiresAt = null
      user.lastLoginAt = new Date()

      // Invalidate every other session so a stolen session cannot survive a
      // password change, then issue a fresh session for the current one.
      await this.adminSessionRepository.revokeAllForUser(new Types.ObjectId(adminUserId), session)
      const token = await this.createSession(adminUserId, session)

      await this.adminUserRepository.save(user, session)

      await this.auditService.record(
        {
          actorId: adminUserId,
          action: 'admin-user.password-changed',
          entityType: 'admin-user',
          entityId: adminUserId,
          changes: { mustChangePassword: false },
        },
        session
      )

      return { user: this.toSafeUser(user), token }
    })
  }
}
