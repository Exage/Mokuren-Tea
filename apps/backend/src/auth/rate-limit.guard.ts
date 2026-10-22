import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

// In-memory fixed-window rate limiter keyed by route and client IP.
//
// Per-process memory is adequate for a single backend instance. Limits are read
// from configuration so operators can tune them (and tests can run without
// tripping them) without changing code. `RATE_LIMIT_MAX` defaults to 30 requests
// per `RATE_LIMIT_WINDOW_MS` (default 60 seconds).
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, { count: number; resetAt: number }>()

  private readonly maxRequests: number
  private readonly windowMs: number

  constructor(config: ConfigService) {
    this.maxRequests = Number(config.get('RATE_LIMIT_MAX')) || 30
    this.windowMs = Number(config.get('RATE_LIMIT_WINDOW_MS')) || 60_000
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest() as {
      ip?: string | null
      socket?: { remoteAddress?: string | null } | null
      path?: string
      originalUrl?: string
      url?: string
    }

    const ip = request.ip || (request.socket && request.socket.remoteAddress) || 'unknown'
    const route = (request.path || request.originalUrl || request.url || 'unknown').split('?')[0]
    const key = `${route}:${ip}`

    const now = Date.now()
    let window = this.windows.get(key)

    if (!window || now >= window.resetAt) {
      window = { count: 0, resetAt: now + this.windowMs }
      this.windows.set(key, window)
    }

    window.count += 1

    if (window.count > this.maxRequests) {
      throw new HttpException(
        { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
        429
      )
    }

    return true
  }
}
