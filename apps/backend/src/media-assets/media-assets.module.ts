import { MediaAssetsRepository } from './media-assets.repository.js'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AuditModule } from '../audit/audit.module.js'
import { AuthModule } from '../auth/auth.module.js'
import { AdminMediaAssetsController } from './admin-media-assets.controller.js'
import { CloudinaryService } from './cloudinary.service.js'
import { MediaAssetsService } from './media-assets.service.js'
import { MediaAsset, MediaAssetSchema } from './schemas/media-asset.schema.js'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: MediaAsset.name, schema: MediaAssetSchema }]),
    AuditModule,
    AuthModule,
  ],
  controllers: [AdminMediaAssetsController],
  providers: [CloudinaryService, MediaAssetsService, MediaAssetsRepository],
  exports: [MediaAssetsService, CloudinaryService],
})
export class MediaAssetsModule {}
