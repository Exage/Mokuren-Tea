import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ProductCatalogQueryDto } from './dto/product-catalog-query.dto.js'
import {
  PublicProductListResponse,
  PublicProductResponse,
} from './dto/public-product-response.dto.js'
import { ProductCatalogService } from './product-catalog.service.js'

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly catalogService: ProductCatalogService) {}

  @Get()
  @ApiOperation({ summary: 'List published products' })
  @ApiOkResponse({ type: PublicProductListResponse })
  list(@Query() query: ProductCatalogQueryDto): Promise<PublicProductListResponse> {
    return this.catalogService.list(query)
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a published product by slug' })
  @ApiOkResponse({ type: PublicProductResponse })
  getBySlug(@Param('slug') slug: string): Promise<PublicProductResponse> {
    return this.catalogService.getBySlug(slug)
  }
}
