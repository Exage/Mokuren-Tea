import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { StoreSettingsService } from './store-settings.service.js'
import { StoreSettingsDto } from './dto/store-settings.dto.js'

@ApiTags('public-store-settings')
@Controller('public/store-settings')
export class PublicStoreSettingsController {
  constructor(private readonly storeSettingsService: StoreSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get public store settings' })
  @ApiOkResponse({ type: StoreSettingsDto })
  getSettings(): Promise<StoreSettingsDto | null> {
    return this.storeSettingsService.getSettings()
  }
}
