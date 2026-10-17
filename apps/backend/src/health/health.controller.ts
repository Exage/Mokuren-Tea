import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { InjectConnection } from '@nestjs/mongoose'
import type { Connection } from 'mongoose'

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  async check() {
    try {
      if (this.connection.readyState !== 1 || !this.connection.db) {
        throw new Error('Database connection is not ready')
      }

      await this.connection.db.command({ ping: 1 }, { timeoutMS: 2000 })
      return { status: 'ok', database: 'up' }
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'down' })
    }
  }
}
