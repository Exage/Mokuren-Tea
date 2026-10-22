import type { AdminRequestUser } from './auth.types.js'
import { randomBytes } from 'node:crypto'
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ConfigService } from '@nestjs/config'
import { AdminSessionGuard } from './admin-session.guard.js'
import { CsrfGuard } from './csrf.guard.js'
import { CurrentAdmin } from './current-admin.decorator.js'
import { AuthService } from './auth.service.js'
import { AdminLoginDto } from './dto/admin-login.dto.js'
import { AdminChangePasswordDto } from './dto/admin-change-password.dto.js'
import { AdminAuthResponse, AdminUserResponse } from './dto/admin-auth-response.dto.js'
import { RateLimitGuard } from './rate-limit.guard.js'
import { RequireCsrf } from './require-csrf.decorator.js'

// Minimal structural type for the response object NestJS injects via @Res().
// Avoids importing the express module types directly.
type HttpCookieResponse = {
  cookie: (name: string, value: string, options?: Record<string, unknown>) => void
  clearCookie: (name: string, options?: Record<string, unknown>) => void
}

const DEFAULT_COOKIE_NAME = 'admin_session'
const DEFAULT_SAME_SITE: 'lax' | 'strict' | 'none' = 'lax'
const DEFAULT_TTL_DAYS = 7

// Administrative authentication. Routes here establish, read, rotate, or end a
// server-side session carried in an HttpOnly cookie. The session token itself is
// never returned in a response body.
@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private cookieName(): string {
    return this.config.get<string>('SESSION_COOKIE_NAME') || DEFAULT_COOKIE_NAME
  }

  private cookieOptions(): Record<string, unknown> {
    const secure = this.config.get('NODE_ENV') === 'production'
    const sameSite =
      (this.config.get<string>('SESSION_COOKIE_SAME_SITE') || DEFAULT_SAME_SITE) as
        | 'lax'
        | 'strict'
        | 'none'

    return {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      domain: this.config.get<string>('SESSION_COOKIE_DOMAIN') || undefined,
      maxAge:
        (Number(this.config.get('SESSION_TTL_DAYS')) || DEFAULT_TTL_DAYS) *
        24 *
        60 *
        60 *
        1000,
    }
  }

  private clearCookieOptions(): Record<string, unknown> {
    const secure = this.config.get('NODE_ENV') === 'production'
    const sameSite =
      (this.config.get<string>('SESSION_COOKIE_SAME_SITE') || DEFAULT_SAME_SITE) as
        | 'lax'
        | 'strict'
        | 'none'

    return {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      domain: this.config.get<string>('SESSION_COOKIE_DOMAIN') || undefined,
    }
  }

  // The CSRF token cookie is intentionally NOT HttpOnly: the page must be able
  // to read it (document.cookie) and echo it back in the X-CSRF-Token header.
  // It carries no session secret — it is a request-origin nonce.
  private csrfCookieOptions(): Record<string, unknown> {
    const secure = this.config.get('NODE_ENV') === 'production'
    const sameSite =
      (this.config.get<string>('SESSION_COOKIE_SAME_SITE') || DEFAULT_SAME_SITE) as
        | 'lax'
        | 'strict'
        | 'none'

    return {
      httpOnly: false,
      secure,
      sameSite,
      path: '/',
      domain: this.config.get<string>('SESSION_COOKIE_DOMAIN') || undefined,
      maxAge:
        (Number(this.config.get('SESSION_TTL_DAYS')) || DEFAULT_TTL_DAYS) *
        24 *
        60 *
        60 *
        1000,
    }
  }

  // Issues a fresh CSRF token cookie so a client can bootstrap a state-changing
  // request. Public: no session is required to obtain the token.
  @Get('csrf-token')
  @HttpCode(204)
  @ApiOperation({ summary: 'Issue a CSRF token cookie' })
  csrfToken(@Res({ passthrough: true }) response: HttpCookieResponse) {
    response.cookie(
      this.config.get<string>('CSRF_TOKEN_NAME') || 'csrf_token',
      randomBytes(32).toString('hex'),
      this.csrfCookieOptions(),
    )
    return
  }

  @Post('login')
  @RequireCsrf()
  @UseGuards(RateLimitGuard, CsrfGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiOkResponse({ type: AdminAuthResponse })
  async login(
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) response: HttpCookieResponse,
  ) {
    const { user, token } = await this.authService.login(dto.email, dto.password)

    response.cookie(this.cookieName(), token, this.cookieOptions())

    return { user, mustChangePassword: user.mustChangePassword }
  }

  @Get('me')
  @UseGuards(AdminSessionGuard)
  @ApiCookieAuth('admin_session')
  @ApiOperation({ summary: 'Return the current administrator profile' })
  @ApiOkResponse({ type: AdminUserResponse })
  me(@CurrentAdmin() admin: AdminRequestUser) {
    return this.authService.getProfile(admin.adminId)
  }

  @Post('logout')
  @UseGuards(AdminSessionGuard, CsrfGuard)
  @ApiCookieAuth('admin_session')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke the current session and clear its cookie' })
  @ApiOkResponse({ description: 'Session revoked' })
  async logout(
    @CurrentAdmin() admin: AdminRequestUser,
    @Res({ passthrough: true }) response: HttpCookieResponse,
  ) {
    if (admin.tokenHash) {
      await this.authService.logout(admin.adminId, admin.tokenHash)
    }

    response.clearCookie(this.cookieName(), this.clearCookieOptions())

    return { message: 'Logged out' }
  }

  @Post('change-password')
  @UseGuards(AdminSessionGuard, CsrfGuard, RateLimitGuard)
  @ApiCookieAuth('admin_session')
  @HttpCode(200)
  @ApiOperation({ summary: 'Change the current administrator password' })
  @ApiOkResponse({ type: AdminAuthResponse })
  async changePassword(
    @CurrentAdmin() admin: AdminRequestUser,
    @Body() dto: AdminChangePasswordDto,
    @Res({ passthrough: true }) response: HttpCookieResponse,
  ) {
    const { user, token } = await this.authService.changePassword(
      admin.adminId,
      dto.currentPassword,
      dto.newPassword,
    )

    response.cookie(this.cookieName(), token, this.cookieOptions())

    return { user, mustChangePassword: user.mustChangePassword }
  }
}
