import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { AdminRequestUser } from './auth.types.js'

// Resolves the administrator authenticated by AdminAuthGuard.
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AdminRequestUser | undefined => {
    const request = context.switchToHttp().getRequest() as { admin?: AdminRequestUser }
    return request.admin
  }
)
