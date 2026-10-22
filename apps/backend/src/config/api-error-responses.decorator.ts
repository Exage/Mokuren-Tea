import { applyDecorators } from '@nestjs/common'
import { ApiResponse } from '@nestjs/swagger'

const ERROR_SCHEMA = {
  type: 'object' as const,
  required: ['code', 'message'],
  properties: {
    code: { type: 'string' as const, example: 'VALIDATION_ERROR' },
    message: { type: 'string' as const },
    details: { type: 'array' as const, items: { type: 'object' as const }, nullable: true },
  },
}

export function ApiPublicErrors() {
  return applyDecorators(
    ApiResponse({ status: 400, description: 'Invalid request', schema: ERROR_SCHEMA }),
    ApiResponse({ status: 409, description: 'Conflict or insufficient stock', schema: ERROR_SCHEMA }),
    ApiResponse({ status: 429, description: 'Rate limit exceeded', schema: ERROR_SCHEMA }),
    ApiResponse({ status: 503, description: 'Dependency unavailable', schema: ERROR_SCHEMA })
  )
}

export function ApiAdminErrors() {
  return applyDecorators(
    ApiResponse({ status: 400, description: 'Invalid request', schema: ERROR_SCHEMA }),
    ApiResponse({ status: 401, description: 'Authentication required', schema: ERROR_SCHEMA }),
    ApiResponse({ status: 403, description: 'Action forbidden', schema: ERROR_SCHEMA }),
    ApiResponse({ status: 404, description: 'Resource not found', schema: ERROR_SCHEMA }),
    ApiResponse({ status: 409, description: 'State, version, or stock conflict', schema: ERROR_SCHEMA }),
    ApiResponse({ status: 503, description: 'Dependency unavailable', schema: ERROR_SCHEMA })
  )
}
