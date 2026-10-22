import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AdminAuthGuard } from '../auth/admin-auth.guard.js'
import { DashboardService } from './dashboard.service.js'
import type { DashboardView } from './dashboard.types.js'
import { DashboardViewDto } from './dto/dashboard-response.dto.js'
import { ApiAdminErrors } from '../config/api-error-responses.decorator.js'

@ApiTags('dashboard')
@ApiAdminErrors()
@ApiBearerAuth()
@ApiCookieAuth('admin_session')
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Get aggregated dashboard overview' })
  @ApiOkResponse({ type: DashboardViewDto })
  getDashboard(): Promise<DashboardView> {
    return this.dashboardService.getDashboard()
  }
}
