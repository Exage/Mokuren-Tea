import type { AdminRequestUser } from './auth.types.js'
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { InjectConnection } from '@nestjs/mongoose'
import { createHash } from 'node:crypto'
import { Types } from 'mongoose'
import type { Connection } from 'mongoose'

function extractToken(request: {
  headers?: Record<string, string | string[] | undefined>
}): string | null {
  const headers = request.headers || {}
  const authorization = headers['authorization']

  if (typeof authorization === 'string' && authorization.toLowerCase().startsWith('bearer ')) {
    const token = authorization.slice('bearer '.length).trim()

    if (token.length > 0) {
      return token
    }
  }

  const direct = headers['x-admin-session']

  if (typeof direct === 'string' && direct.trim().length > 0) {
    return direct.trim()
  }

  const cookieHeader = headers['cookie']

  if (typeof cookieHeader === 'string') {
    for (const part of cookieHeader.split(';')) {
      const [name, ...rest] = part.trim().split('=')

      if (name === 'admin_session' && rest.length > 0) {
        const token = rest.join('=').trim()

        if (token.length > 0) {
          return token
        }
      }
    }
  }

  return null
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

// Minimal but real admin session check backed by MongoDB collections.
// Fails closed: unknown, expired, revoked or inactive sessions are rejected,
// and accounts flagged with mustChangePassword cannot use admin endpoints.
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() as {
      headers?: Record<string, string | string[] | undefined>
      admin?: AdminRequestUser
    }
    const token = extractToken(request)

    if (!token) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Admin session required' })
    }

    const db = this.connection.db

    if (!db) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Admin session required' })
    }

    const tokenHash = hashSessionToken(token)
    const session = await db.collection('adminsessions').findOne({ tokenHash })

    if (!session) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid admin session' })
    }

    if (session.revokedAt) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Admin session revoked' })
    }

    if (session.expiresAt instanceof Date && session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Admin session expired' })
    }

    if (!Types.ObjectId.isValid(String(session.adminUserId))) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid admin session' })
    }

    const adminUser = await db
      .collection('adminusers')
      .findOne({ _id: new Types.ObjectId(String(session.adminUserId)) })

    if (!adminUser || adminUser.isActive !== true) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Administrator is inactive',
      })
    }

    if (adminUser.mustChangePassword === true) {
      throw new ForbiddenException({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Password change required before using admin API',
      })
    }

    request.admin = { adminId: String(adminUser._id) }
    return true
  }
}
