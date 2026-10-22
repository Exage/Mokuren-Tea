import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { REQUIRE_CSRF } from './require-csrf.decorator.js'

// Parses a Cookie header string into a name/value map.
function parseCookies(
  cookieHeader: string | undefined,
  protectedNames: string[]
): Record<string, string> {
  const cookies: Record<string, string> = Object.create(null)
  if (!cookieHeader) {
    return cookies
  }

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) {
      continue
    }

    const name = part.slice(0, separator).trim()
    const value = part.slice(separator + 1)

    if (protectedNames.includes(name)) {
      if (Object.hasOwn(cookies, name)) {
        throw new ForbiddenException({
          code: 'CSRF_REQUIRED',
          message: 'Ambiguous cookie header',
        })
      }
      cookies[name] = value
    }
  }

  return cookies
}

// CSRF double-submit guard for state-changing cookie-authenticated requests.
//
// A `csrf_token` cookie is issued (readable by the page) and the client must
// echo it back in the `X-CSRF-Token` header on POST/PATCH/PUT/DELETE. Because
// the cookie is sent cross-origin only with the browser's own credentialed
// requests, a cross-site form cannot read the cookie value and therefore
// cannot forge a matching header.
//
// CSRF is required whenever the request carries a session cookie
// (`admin_session`) or a CSRF token cookie (`csrf_token`), and always for
// login. There is no blanket "first request" exemption: `GET
// /api/admin/auth/csrf-token` is public and issues the token cookie, so every
// mutating request can (and must) present a matching header. Requests that
// authenticate solely via the `Authorization` header carry no cookie and are
// not vulnerable to cookie-based CSRF, so they are not checked here.
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly sessionCookieName: string
  private readonly csrfTokenCookieName: string

  constructor(
    config: ConfigService,
    private readonly reflector: Reflector
  ) {
    this.sessionCookieName = config.get<string>('SESSION_COOKIE_NAME') || 'admin_session'
    this.csrfTokenCookieName = config.get<string>('CSRF_TOKEN_NAME') || 'csrf_token'
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest() as {
      method?: string
      headers?: Record<string, string | string[] | undefined>
    }

    const method = (request.method || 'GET').toUpperCase()

    // Safe methods never mutate state and are never CSRF-checked.
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return true
    }

    const headers = request.headers
    const cookies = parseCookies(typeof headers?.cookie === 'string' ? headers.cookie : undefined, [
      this.sessionCookieName,
      this.csrfTokenCookieName,
    ])

    const hasSessionCookie = Object.hasOwn(cookies, this.sessionCookieName)
    const hasCsrfTokenCookie = Object.hasOwn(cookies, this.csrfTokenCookieName)
    const requiresCsrf = this.reflector.getAllAndOverride<boolean>(REQUIRE_CSRF, [
      context.getHandler(),
      context.getClass(),
    ])

    // Cookie-authenticated requests and login always require a CSRF token.
    if (!hasSessionCookie && !hasCsrfTokenCookie && !requiresCsrf) {
      return true
    }

    const expected = cookies[this.csrfTokenCookieName]

    if (!expected) {
      throw new ForbiddenException({
        code: 'CSRF_REQUIRED',
        message: 'CSRF token is required',
      })
    }

    const headerToken = headers ? headers['x-csrf-token'] : undefined
    const provided = Array.isArray(headerToken) ? headerToken[0] : headerToken

    if (!provided || provided !== expected) {
      throw new ForbiddenException({
        code: 'CSRF_REQUIRED',
        message: 'CSRF token is required',
      })
    }

    return true
  }
}
