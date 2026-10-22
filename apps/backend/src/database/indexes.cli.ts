import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { getConnectionToken } from '@nestjs/mongoose'
import type { Connection } from 'mongoose'
import { AppModule } from '../app.module.js'

import { IndexesService } from './indexes.service.js'

async function run(): Promise<void> {
  const mode = process.argv[2] || 'report'
  if (mode !== 'report' && mode !== 'ensure') {
    throw new Error('Expected report or ensure')
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] })
  try {
    const connection = app.get<Connection>(getConnectionToken())
    const indexes = new IndexesService(connection)
    const duplicates = await indexes.report()
    if (duplicates > 0) {
      throw new Error('Resolve duplicate unique keys before creating indexes')
    }
    if (mode === 'ensure') {
      await indexes.ensure()
    }
  } finally {
    await app.close()
  }
}

run().catch((error: unknown) => {
  Logger.error(error, undefined, 'IndexReport')
  process.exitCode = 1
})
