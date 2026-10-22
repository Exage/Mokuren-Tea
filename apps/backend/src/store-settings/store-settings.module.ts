import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AuditModule } from '../audit/audit.module.js'
import { StoreSettingsService } from './store-settings.service.js'
import { PublicStoreSettingsController } from './public-store-settings.controller.js'
import { AdminStoreSettingsController } from './admin-store-settings.controller.js'
import { StoreSettings, StoreSettingsSchema } from './schemas/store-settings.schema.js'

@Module({
  imports: [AuditModule, MongooseModule.forFeature([{ name: StoreSettings.name, schema: StoreSettingsSchema }])],
  controllers: [PublicStoreSettingsController, AdminStoreSettingsController],
  providers: [StoreSettingsService],
  exports: [StoreSettingsService],
})
export class StoreSettingsModule {}
