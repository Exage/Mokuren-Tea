import type { AdminRequestUser } from './auth.types.js'
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { InjectConnection } from '@nestjs/mongoose'
import { ConfigService } from '@nestjs/config'
import { createHash } from 'node:crypto'
import type { Connection } from 'mongoose'
import { extractToken, authenticateAdmin } from './admin-auth.guard.js'

// Session-only admin guard. Authenticates the session and the account, but does
// NOT reject mustChangePassword accounts: a temporary-password session may still
// read the current profile, change its password, or log out. Every other admin
// route uses AdminAuthGuard, which blocks mustChangePassword accounts.
@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() as {
      headers?: Record<string, string | string[] | undefined>
      admin?: AdminRequestUser
    }
    const token = extractToken(
      request,
      this.config.get<string>('SESSION_COOKIE_NAME') || 'admin_session',
    )

    if (!token) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Admin session required' })
    }

    const { adminUser } = await authenticateAdmin(this.connection, token)

    request.admin = {
      adminId: String(adminUser._id),
      mustChangePassword: Boolean(adminUser.mustChangePassword),
      token,
      tokenHash: createHash('sha256').update(token, 'utf8').digest('hex'),
    }
    return true
  }
}
