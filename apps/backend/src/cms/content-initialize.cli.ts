import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from '../app.module.js'
import { CmsService } from './cms.service.js'
import { StoreSettingsService } from '../store-settings/store-settings.service.js'

async function run(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  })

  try {
    await app.get(CmsService).initializeFixedBlocks(null)
    await app
      .get(StoreSettingsService)
      .initializeDefaultSettings(
        { name: 'Mokuren Tea', tagline: 'Find your moment of calm.' },
        null
      )
    Logger.log('Fixed CMS blocks and store settings are initialized', 'ContentInitialize')
  } finally {
    await app.close()
  }
}

run().catch((error: unknown) => {
  Logger.error(error, undefined, 'ContentInitialize')
  process.exitCode = 1
})
