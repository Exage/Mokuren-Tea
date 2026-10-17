import type { AdminRequestUser } from '../auth/auth.types.js'
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AdminAuthGuard } from '../auth/admin-auth.guard.js'
import { CurrentAdmin } from '../auth/current-admin.decorator.js'
import { AdminProductListResponse, AdminProductResponse } from './dto/admin-product-response.dto.js'
import { AdminProductsQueryDto } from './dto/admin-products-query.dto.js'
import { CreateProductDto } from './dto/create-product.dto.js'
import { CreateProductVariantDto } from './dto/create-product-variant.dto.js'
import { UpdateProductDto } from './dto/update-product.dto.js'
import { UpdateProductVariantDto } from './dto/update-product-variant.dto.js'
import { ProductsService } from './products.service.js'

// Administrative product management. The controller only validates input,
// resolves the actor and delegates every rule, transaction and audit entry
// to ProductsService.
@ApiTags('admin-products')
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'List products for administrators' })
  @ApiOkResponse({ type: AdminProductListResponse })
  list(@Query() query: AdminProductsQueryDto): Promise<AdminProductListResponse> {
    return this.productsService.listAdmin(query)
  }

  @Post()
  // TODO: Restore admin authentication for product creation.
  // @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Create a draft product' })
  @ApiOkResponse({ type: AdminProductResponse })
  create(
    @Body() dto: CreateProductDto,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<AdminProductResponse> {
    return this.productsService.createDraft(dto, admin?.adminId)
  }

  @Get(':id')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Get an administrative product card' })
  @ApiOkResponse({ type: AdminProductResponse })
  getById(@Param('id') id: string): Promise<AdminProductResponse> {
    return this.productsService.getAdminCard(id)
  }

  @Patch(':id')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Update an administrative product card' })
  @ApiOkResponse({ type: AdminProductResponse })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<AdminProductResponse> {
    return this.productsService.updateCard(id, dto, admin?.adminId)
  }

  @Post(':id/publish')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Publish a draft product' })
  @ApiOkResponse({ type: AdminProductResponse })
  publish(
    @Param('id') id: string,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<AdminProductResponse> {
    return this.productsService.publish(id, admin?.adminId)
  }

  @Post(':id/archive')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Archive a product' })
  @ApiOkResponse({ type: AdminProductResponse })
  archive(
    @Param('id') id: string,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<AdminProductResponse> {
    return this.productsService.archive(id, admin?.adminId)
  }

  @Post(':id/variants')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Add a variant to a product' })
  @ApiOkResponse({ type: AdminProductResponse })
  addVariant(
    @Param('id') id: string,
    @Body() dto: CreateProductVariantDto,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<AdminProductResponse> {
    return this.productsService.addVariant(id, dto, admin?.adminId)
  }

  @Patch(':id/variants/:variantId')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Update a product variant' })
  @ApiOkResponse({ type: AdminProductResponse })
  updateVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateProductVariantDto,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<AdminProductResponse> {
    return this.productsService.updateVariant(id, variantId, dto, admin?.adminId)
  }
}
