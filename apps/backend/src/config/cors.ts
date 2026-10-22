import type { ConfigService } from '@nestjs/config'

export function parseCorsOrigins(value: unknown): string[] {
  if (value === undefined || value === '') {
    return []
  }
  if (typeof value !== 'string') {
    throw new Error('CORS_ORIGINS must be a comma-separated list of HTTP origins')
  }

  return value.split(',').map((entry) => {
    const origin = entry.trim()
    let url: URL
    try {
      url = new URL(origin)
    } catch {
      throw new Error('CORS_ORIGINS must contain exact HTTP origins without wildcards')
    }
    if (origin.includes('*') || !['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
      throw new Error('CORS_ORIGINS must contain exact HTTP origins without paths or credentials')
    }
    return origin
  })
}

export function corsOptions(config: ConfigService) {
  return {
    origin: parseCorsOrigins(config.get('CORS_ORIGINS')),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Session', 'X-CSRF-Token'],
  }
}
