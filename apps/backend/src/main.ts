import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module.js'
import { corsOptions } from './config/cors.js'
import { requestValidationPipe } from './config/request-validation.js'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const config = app.get(ConfigService)

  app.enableCors(corsOptions(config))
  app.setGlobalPrefix('api')
  app.useGlobalPipes(requestValidationPipe())
  app.enableShutdownHooks()

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Mokuren Tea API')
    .setDescription('Public catalog API and administrative API. Administrative endpoints are protected by an HttpOnly admin session cookie (admin_session) and require CSRF tokens on state-changing requests.')
    .setVersion('0.1.0')
    .addCookieAuth(config.get<string>('SESSION_COOKIE_NAME') || 'admin_session', {
      type: 'apiKey',
      in: 'cookie',
      description: 'HttpOnly admin session cookie set on successful login.',
    }, 'admin_session')
    .addBearerAuth()
    .build()
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('api/docs', app, swaggerDocument)

  await app.listen(config.getOrThrow<number>('PORT'))
  Logger.log(`Backend listening at ${await app.getUrl()}/api`, 'Bootstrap')
}

bootstrap().catch((error: unknown) => {
  Logger.error(error, undefined, 'Bootstrap')
  process.exitCode = 1
})
