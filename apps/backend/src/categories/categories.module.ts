import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AuditModule } from '../audit/audit.module.js'
import { CategoriesRepository } from './categories.repository.js'
import { CategoriesService } from './categories.service.js'
import { Category, CategorySchema } from './schemas/category.schema.js'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Category.name, schema: CategorySchema }]),
    AuditModule,
  ],
  providers: [CategoriesRepository, CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
