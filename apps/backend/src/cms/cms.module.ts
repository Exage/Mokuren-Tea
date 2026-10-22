import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { ProductsModule } from '../products/products.module.js'
import { MediaAssetsModule } from '../media-assets/media-assets.module.js'
import { AuditModule } from '../audit/audit.module.js'
import { CmsService } from './cms.service.js'
import { CmsBlocksRepository, CmsRevisionsRepository } from './cms.repository.js'
import { PublicCmsController } from './public-cms.controller.js'
import { AdminCmsController } from './admin-cms.controller.js'
import { CmsBlock, CmsBlockSchema } from './schemas/cms-block.schema.js'
import { CmsRevision, CmsRevisionSchema } from './schemas/cms-revision.schema.js'

@Module({
  imports: [
    ProductsModule,
    MediaAssetsModule,
    AuditModule,
    MongooseModule.forFeature([
      { name: CmsBlock.name, schema: CmsBlockSchema },
      { name: CmsRevision.name, schema: CmsRevisionSchema },
    ]),
  ],
  controllers: [PublicCmsController, AdminCmsController],
  providers: [CmsService, CmsBlocksRepository, CmsRevisionsRepository],
  exports: [CmsService],
})
export class CmsModule {}
