import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from '../app.module.js'
import { MediaAssetsService } from './media-assets.service.js'

// Service command for stuck uploads and unfinished deletions, plus the
// one-time usageCount recount for pre-existing data. Run after build:
//   node dist/media-assets/media-assets-reconcile.cli.js reconcile
//   node dist/media-assets/media-assets-reconcile.cli.js recount
async function run(): Promise<void> {
  const mode = process.argv[2] ?? 'reconcile'
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  })

  try {
    const service = app.get(MediaAssetsService)

    if (mode === 'recount') {
      const result = await service.recalculateUsageCounts()
      Logger.log(`Recounted product image usage: ${JSON.stringify(result)}`, 'MediaReconcile')
    } else if (mode === 'reconcile') {
      const result = await service.reconcileStuck()
      Logger.log(`Reconciled stuck media assets: ${JSON.stringify(result)}`, 'MediaReconcile')
    } else {
      Logger.error(
        `Unknown mode "${mode}", expected reconcile or recount`,
        undefined,
        'MediaReconcile'
      )
      process.exitCode = 1
    }
  } finally {
    await app.close()
  }
}

run().catch((error: unknown) => {
  Logger.error(error, undefined, 'MediaReconcile')
  process.exitCode = 1
})
