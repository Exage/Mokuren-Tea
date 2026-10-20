import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'
import { fileURLToPath } from 'node:url'
import { validateEnvironment } from './config/environment.js'
import { HealthController } from './health/health.controller.js'
import { MediaAssetsModule } from './media-assets/media-assets.module.js'
import { ProductsModule } from './products/products.module.js'
import { CategoryManagementModule } from './categories/category-management.module.js'
import { TasteNoteManagementModule } from './taste-notes/taste-note-management.module.js'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: fileURLToPath(new URL('../.env', import.meta.url)),
      validate: validateEnvironment,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
        autoIndex: config.get<string>('NODE_ENV') !== 'production',
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        retryAttempts: 3,
        retryDelay: 1000,
      }),
    }),
    ProductsModule,
    MediaAssetsModule,
    CategoryManagementModule,
    TasteNoteManagementModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
