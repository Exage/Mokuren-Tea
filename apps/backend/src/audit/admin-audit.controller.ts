import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AdminAuthGuard } from '../auth/admin-auth.guard.js'
import { AuditService } from './audit.service.js'
import { AuditLogQueryDto } from './dto/audit-log-query.dto.js'
import { ApiAdminErrors } from '../config/api-error-responses.decorator.js'
import { AuditLogListDto } from './dto/audit-log-response.dto.js'

@ApiTags('admin-audit')
@ApiAdminErrors()
@ApiBearerAuth()
@ApiCookieAuth('admin_session')
@Controller('admin/audit')
export class AdminAuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Read audit logs with filters and pagination' })
  @ApiOkResponse({ type: AuditLogListDto })
  list(@Query() query: AuditLogQueryDto) {
    return this.auditService.list({
      actorId: query.actorId,
      action: query.action,
      entityType: query.entityType,
      entityId: query.entityId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page,
      limit: query.limit,
    })
  }
}
