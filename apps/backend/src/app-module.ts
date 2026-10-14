import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'
import { fileURLToPath } from 'node:url'
import { validateEnvironment } from './config/environment.js'
import { HealthController } from './health/health-controller.js'

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
  ],
  controllers: [HealthController],
})
export class AppModule {}
