import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { AuditModule } from '../audit/audit.module.js'
import { CategoriesModule } from './categories.module.js'
import { ProductsModule } from '../products/products.module.js'
import { AdminCategoriesController } from './admin-categories.controller.js'
import { CategoriesController } from './categories.controller.js'
import { CategoryManagementService } from './category-management.service.js'

// Coordinates category use cases and registers both category controllers.
// Imports both feature modules; CategoriesModule stays independent of
// ProductsModule so the dependency graph remains acyclic.
@Module({
  imports: [CategoriesModule, ProductsModule, AuthModule, AuditModule],
  controllers: [AdminCategoriesController, CategoriesController],
  providers: [CategoryManagementService],
  exports: [CategoryManagementService],
})
export class CategoryManagementModule {}
