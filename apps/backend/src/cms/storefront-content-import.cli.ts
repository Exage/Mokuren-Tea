import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from '../app.module.js'
import { CmsService } from './cms.service.js'
import { MediaAssetsService } from '../media-assets/media-assets.service.js'
import { ProductsService } from '../products/products.service.js'
import { StorefrontContentImportService } from './storefront-content-import.service.js'

async function run(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.some((value) => value !== '--publish')) {
    throw new Error('Usage: content:import-storefront [--publish]')
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] })
  try {
    const importer = new StorefrontContentImportService(
      app.get(CmsService),
      app.get(MediaAssetsService),
      app.get(ProductsService)
    )
    console.log(
      JSON.stringify(await importer.importContent({ publish: args.includes('--publish') }), null, 2)
    )
  } finally {
    await app.close()
  }
}
run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Storefront import failed')
  process.exitCode = 1
})
