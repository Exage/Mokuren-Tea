import 'reflect-metadata'
import { Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module.js'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const config = app.get(ConfigService)

  app.setGlobalPrefix('api')
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    })
  )
  app.enableShutdownHooks()

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Mokuren Tea API')
    .setDescription('Public catalog and administrative product API')
    .setVersion('0.1.0')
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
