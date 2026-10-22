import { BadRequestException, ValidationPipe } from '@nestjs/common'
import type { ValidationError } from 'class-validator'

function issues(errors: ValidationError[], parent = ''): Array<{ field: string; messages: string[] }> {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property
    const own = error.constraints
      ? [{ field, messages: Object.values(error.constraints) }]
      : []
    return [...own, ...issues(error.children ?? [], field)]
  })
}

export function requestValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    exceptionFactory: (errors) => new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: issues(errors),
    }),
  })
}
