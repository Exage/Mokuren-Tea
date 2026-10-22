import type { ReservationEventView } from './reservations.types.js'
import type { AdminRequestUser } from '../auth/auth.types.js'
import type { ReservationView, ReservationList } from './reservations.types.js'
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { AdminAuthGuard } from '../auth/admin-auth.guard.js'
import { CsrfGuard } from '../auth/csrf.guard.js'
import { CurrentAdmin } from '../auth/current-admin.decorator.js'
import { ApiAdminErrors } from '../config/api-error-responses.decorator.js'
import { ReservationsService } from './reservations.service.js'
import { UpdateReservationDto } from './dto/update-reservation.dto.js'
import { CreateAdminReservationDto } from './dto/create-reservation.dto.js'
import {
  AdminReservationsQueryDto,
  CancelReservationDto,
} from './dto/admin-reservations-query.dto.js'
import {
  ReservationListDto,
  ReservationEventDto,
  ReservationViewDto,
} from './dto/reservation-response.dto.js'

@ApiTags('admin-reservations')
@ApiAdminErrors()
@ApiBearerAuth()
@ApiCookieAuth('admin_session')
@Controller('admin/reservations')
export class AdminReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @UseGuards(AdminAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Create a new reservation on behalf of a customer' })
  @ApiCreatedResponse({ type: ReservationViewDto })
  create(
    @Body() dto: CreateAdminReservationDto,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<ReservationView> {
    return this.reservationsService.createPublic(
      {
        source: 'admin',
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        lines: dto.lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
        })),
        actorId: admin?.adminId ?? null,
      },
      null
    )
  }

  @Get()
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'List reservations with filters and pagination' })
  @ApiOkResponse({ type: ReservationListDto })
  list(@Query() query: AdminReservationsQueryDto): Promise<ReservationList> {
    return this.reservationsService.listReservations({
      status: query.status,
      source: query.source,
      customerName: query.customerName,
      customerPhone: query.customerPhone,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page,
      limit: query.limit,
    })
  }

  @Get(':id')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Get a reservation by id' })
  @ApiOkResponse({ type: ReservationViewDto })
  getById(@Param('id') id: string): Promise<ReservationView> {
    return this.reservationsService.getReservation(id)
  }

  @Get(':id/events')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'List reservation events (history)' })
  @ApiOkResponse({ type: [ReservationEventDto] })
  getEvents(@Param('id') id: string): Promise<ReservationEventView[]> {
    return this.reservationsService.listReservationEvents(id)
  }

  @Patch(':id')
  @UseGuards(AdminAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Edit a reservation (only new status)' })
  @ApiOkResponse({ type: ReservationViewDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReservationDto,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<ReservationView> {
    return this.reservationsService.updateReservation(
      id,
      {
        lines: dto.lines?.map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
        })),
        customerName: dto.customerName ?? undefined,
        customerPhone: dto.customerPhone ?? undefined,
      },
      admin?.adminId ?? null
    )
  }

  @Post(':id/confirm')
  @UseGuards(AdminAuthGuard, CsrfGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm a reservation and reserve stock' })
  @ApiOkResponse({ type: ReservationViewDto })
  confirm(
    @Param('id') id: string,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<ReservationView> {
    return this.reservationsService.confirm(id, admin?.adminId ?? null)
  }

  @Post(':id/ready')
  @UseGuards(AdminAuthGuard, CsrfGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark a reservation as ready' })
  @ApiOkResponse({ type: ReservationViewDto })
  ready(
    @Param('id') id: string,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<ReservationView> {
    return this.reservationsService.ready(id, admin?.adminId ?? null)
  }

  @Post(':id/complete')
  @UseGuards(AdminAuthGuard, CsrfGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Complete a reservation (write off stock)' })
  @ApiOkResponse({ type: ReservationViewDto })
  complete(
    @Param('id') id: string,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<ReservationView> {
    return this.reservationsService.complete(id, admin?.adminId ?? null)
  }

  @Post(':id/cancel')
  @UseGuards(AdminAuthGuard, CsrfGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a reservation' })
  @ApiOkResponse({ type: ReservationViewDto })
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelReservationDto,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<ReservationView> {
    return this.reservationsService.cancel(id, admin?.adminId ?? null, dto.teaReturned ?? false)
  }
}
