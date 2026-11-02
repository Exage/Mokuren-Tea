import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ProductCatalogQueryDto } from './dto/product-catalog-query.dto.js'
import { ProductsByIdsQueryDto } from './dto/products-by-ids-query.dto.js'
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

  @Get('by-ids')
  @ApiOperation({ summary: 'Get published products by ID, omitting missing or unpublished IDs' })
  @ApiOkResponse({ type: PublicProductResponse, isArray: true })
  @ApiBadRequestResponse({ description: 'ids must contain between 1 and 100 MongoDB ObjectIds' })
  getByIds(@Query() query: ProductsByIdsQueryDto): Promise<PublicProductResponse[]> {
    return this.catalogService.getPublishedByIds([
      ...new Set(query.ids.map((id) => id.toLowerCase())),
    ])
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a published product by slug' })
  @ApiOkResponse({ type: PublicProductResponse })
  getBySlug(@Param('slug') slug: string): Promise<PublicProductResponse> {
    return this.catalogService.getBySlug(slug)
  }
}
