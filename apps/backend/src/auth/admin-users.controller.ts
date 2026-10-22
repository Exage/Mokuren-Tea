import type { AdminRequestUser } from './auth.types.js'
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
import { ApiBearerAuth, ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AdminAuthGuard } from './admin-auth.guard.js'
import { CsrfGuard } from './csrf.guard.js'
import { CurrentAdmin } from './current-admin.decorator.js'
import { AdminUsersService } from './admin-users.service.js'
import { RateLimitGuard } from './rate-limit.guard.js'
import { AdminUserDto, AdminUserCreateResponse, AdminUserListResponse } from './dto/admin-user.dto.js'
import { CreateAdminUserDto } from './dto/create-admin-user.dto.js'
import { UpdateAdminUserDto } from './dto/create-admin-user.dto.js'
import { AdminUsersQueryDto } from './dto/admin-users-query.dto.js'
import type { AdminUserDocument } from './schemas/admin-user.schema.js'

// Administrative user management. Every route is protected by the full-access
// admin guard, so temporary-password accounts (mustChangePassword) cannot
// reach these endpoints. State-changing routes also require a CSRF token.
@ApiTags('admin-users')
@ApiBearerAuth()
@ApiCookieAuth('admin_session')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  private toDto(user: {
    id: string
    email: string
    displayName: string
    isActive: boolean
    mustChangePassword: boolean
    createdAt: Date
    updatedAt: Date
    lastLoginAt: Date | null
  }): AdminUserDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    }
  }

  @Get()
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'List administrators' })
  @ApiOkResponse({ type: AdminUserListResponse })
  async list(
    @Query() query: AdminUsersQueryDto,
  ): Promise<AdminUserListResponse> {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const { items, totalItems } = await this.adminUsersService.listUsers(page, limit, query.search)
    const totalPages = Math.ceil(totalItems / limit)

    return {
      items: items.map((item: AdminUserDocument) => this.toDto(item)),
      pagination: { page, limit, totalItems, totalPages },
    }
  }

  @Post()
  @UseGuards(AdminAuthGuard, CsrfGuard, RateLimitGuard)
  @HttpCode(201)
  @ApiOperation({ summary: 'Create an administrator (temporary password returned once)' })
  @ApiCreatedResponse({ type: AdminUserCreateResponse })
  async create(
    @Body() dto: CreateAdminUserDto,
    @CurrentAdmin() admin: AdminRequestUser,
  ): Promise<AdminUserCreateResponse> {
    const result = await this.adminUsersService.createUser(dto.email, dto.displayName, admin.adminId)

    const response: AdminUserCreateResponse = {
      user: this.toDto(result.user),
    }

    if (result.temporaryPassword) {
      response.temporaryPassword = result.temporaryPassword
      response.temporaryPasswordExpiresAt = result.temporaryPasswordExpiresAt!.toISOString()
    }

    return response
  }

  @Patch(':id')
  @UseGuards(AdminAuthGuard, CsrfGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Update an administrator (displayName and isActive only)' })
  @ApiOkResponse({ type: AdminUserDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserDto,
    @CurrentAdmin() admin: AdminRequestUser,
  ): Promise<AdminUserDto> {
    return this.toDto(await this.adminUsersService.updateUser(id, dto, admin.adminId))
  }

  @Post(':id/reset-password')
  @UseGuards(AdminAuthGuard, CsrfGuard, RateLimitGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Issue a new temporary password and revoke all sessions' })
  @ApiOkResponse({ type: AdminUserCreateResponse })
  async resetPassword(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminRequestUser,
  ): Promise<AdminUserCreateResponse> {
    const result = await this.adminUsersService.resetPassword(id, admin.adminId)

    return {
      user: this.toDto(result.user),
      temporaryPassword: result.temporaryPassword,
      temporaryPasswordExpiresAt: result.temporaryPasswordExpiresAt.toISOString(),
    }
  }

  @Post(':id/revoke-sessions')
  @UseGuards(AdminAuthGuard, CsrfGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke all sessions for an administrator' })
  @ApiOkResponse({ description: 'Sessions revoked' })
  revokeSessions(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminRequestUser,
  ): Promise<{ revokedCount: number }> {
    return this.adminUsersService.revokeSessions(id, admin.adminId)
  }
}
