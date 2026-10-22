import type { AdminRequestUser } from '../auth/auth.types.js'
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AdminAuthGuard } from '../auth/admin-auth.guard.js'
import { CsrfGuard } from '../auth/csrf.guard.js'
import { CurrentAdmin } from '../auth/current-admin.decorator.js'
import {
  AdminCategoryListResponse,
  AdminCategoryResponse,
} from './dto/admin-category-response.dto.js'
import { AdminCategoriesQueryDto } from './dto/admin-categories-query.dto.js'
import { CreateCategoryDto } from './dto/create-category.dto.js'
import { MoveAndDeleteCategoryDto } from './dto/move-and-delete-category.dto.js'
import { MoveAndDeleteCategoryResponse } from './dto/move-and-delete-category-response.dto.js'
import { UpdateCategoryDto } from './dto/update-category.dto.js'
import { CategoriesService } from './categories.service.js'
import { CategoryManagementService } from './category-management.service.js'

// Administrative category management. The class-level guard ensures every
// method here is authenticated; the controller only resolves the actor and
// delegates rules, transactions and audit to CategoriesService. Mutating
// routes additionally require a CSRF token because they are
// cookie-session-authenticated.
@ApiTags('admin-categories')
@UseGuards(AdminAuthGuard, CsrfGuard)
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly categoryManagementService: CategoryManagementService
  ) {}

  @Get()
  @ApiOperation({ summary: 'List categories for administrators' })
  @ApiOkResponse({ type: AdminCategoryListResponse })
  list(@Query() query: AdminCategoriesQueryDto) {
    return this.categoryManagementService.listAdminCategories(query)
  }

  @Post()
  @ApiOperation({ summary: 'Create a category' })
  @ApiCreatedResponse({ type: AdminCategoryResponse })
  create(
    @Body() dto: CreateCategoryDto,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<AdminCategoryResponse> {
    return this.categoriesService.create(dto, admin?.adminId || null)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a category' })
  @ApiOkResponse({ type: AdminCategoryResponse })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<AdminCategoryResponse> {
    const productsCount = await this.categoryManagementService.countProductsForCategory(id)
    return this.categoriesService.update(id, dto, admin?.adminId || null, productsCount)
  }

  @Post(':id/move-and-delete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Move products to a target category and delete the source' })
  @ApiOkResponse({ type: MoveAndDeleteCategoryResponse })
  moveAndDelete(
    @Param('id') id: string,
    @Body() dto: MoveAndDeleteCategoryDto,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<MoveAndDeleteCategoryResponse> {
    return this.categoryManagementService.moveAndDeleteCategory(id, dto, admin?.adminId || null)
  }
}
