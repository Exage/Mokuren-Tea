import { ProductsRepository } from './products.repository.js'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AuditModule } from '../audit/audit.module.js'
import { AuthModule } from '../auth/auth.module.js'
import { CategoriesModule } from '../categories/categories.module.js'
import { InventoryModule } from '../inventory/inventory.module.js'
import { MediaAssetsModule } from '../media-assets/media-assets.module.js'
import { AdminProductsController } from './admin-products.controller.js'
import { ProductCatalogService } from './product-catalog.service.js'
import { ProductsController } from './products.controller.js'
import { ProductsService } from './products.service.js'
import { Product, ProductSchema } from './schemas/product.schema.js'
import { TasteNotesModule } from '../taste-notes/taste-notes.module.js'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
    InventoryModule,
    MediaAssetsModule,
    AuditModule,
    AuthModule,
    CategoriesModule,
    TasteNotesModule,
  ],
  controllers: [ProductsController, AdminProductsController],
  providers: [ProductsService, ProductCatalogService, ProductsRepository],
  // Reservations and CMS will consume product reads/writes; only the
  // services are shared, never controllers or schemas.
  exports: [ProductsService, ProductCatalogService],
})
export class ProductsModule {}
