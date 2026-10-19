import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { PublicCategoryListResponse } from './dto/public-category-response.dto.js'
import { CategoryManagementService } from './category-management.service.js'

// Public category discovery: no session required.
@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoryManagementService: CategoryManagementService) {}

  @Get()
  @ApiOperation({ summary: 'List categories visible in the public catalog' })
  @ApiOkResponse({ type: PublicCategoryListResponse })
  async list(): Promise<PublicCategoryListResponse> {
    const items = await this.categoryManagementService.listPublicCategories()
    return { items }
  }
}
