import type { AdminRequestUser } from '../auth/auth.types.js'
import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AdminAuthGuard } from '../auth/admin-auth.guard.js'
import { CsrfGuard } from '../auth/csrf.guard.js'
import { CurrentAdmin } from '../auth/current-admin.decorator.js'
import { ApiAdminErrors } from '../config/api-error-responses.decorator.js'
import { StoreSettingsService } from './store-settings.service.js'
import { UpdateStoreSettingsDto } from './dto/store-settings.dto.js'
import { StoreSettingsDto } from './dto/store-settings.dto.js'

@ApiTags('admin-store-settings')
@ApiAdminErrors()
@ApiBearerAuth()
@ApiCookieAuth('admin_session')
@Controller('admin/store-settings')
export class AdminStoreSettingsController {
  constructor(private readonly storeSettingsService: StoreSettingsService) {}

  @Get()
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Get store settings (admin)' })
  @ApiOkResponse({ type: StoreSettingsDto })
  getSettings(): Promise<StoreSettingsDto | null> {
    return this.storeSettingsService.getSettings()
  }

  @Patch()
  @UseGuards(AdminAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Partially update store settings' })
  @ApiOkResponse({ type: StoreSettingsDto })
  updateSettings(
    @Body() dto: UpdateStoreSettingsDto,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<StoreSettingsDto> {
    return this.storeSettingsService.updateSettings(
      {
        name: dto.name,
        tagline: dto.tagline,
        address: dto.address,
        hours: dto.hours,
        phone: dto.phone,
        contacts: dto.contacts,
      },
      admin?.adminId ?? null
    )
  }
}
