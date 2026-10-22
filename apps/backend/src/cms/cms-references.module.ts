import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { CmsReferencesService } from './cms-references.service.js'
import { CmsBlock, CmsBlockSchema } from './schemas/cms-block.schema.js'

// Product archiving needs CMS references without importing the editorial
// module, which itself depends on products for publication validation.
@Module({
  imports: [MongooseModule.forFeature([{ name: CmsBlock.name, schema: CmsBlockSchema }])],
  providers: [CmsReferencesService],
  exports: [CmsReferencesService],
})
export class CmsReferencesModule {}
