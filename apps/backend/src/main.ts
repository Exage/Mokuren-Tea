import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app-module.js'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const config = app.get(ConfigService)

  app.setGlobalPrefix('api')
  app.enableShutdownHooks()

  await app.listen(config.getOrThrow<number>('PORT'))
  Logger.log(`Backend listening at ${await app.getUrl()}/api`, 'Bootstrap')
}

bootstrap().catch((error: unknown) => {
  Logger.error(error, undefined, 'Bootstrap')
  process.exitCode = 1
})
