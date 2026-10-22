import type { ReservationView } from './reservations.types.js'
import { Body, Controller, Headers, Post, HttpCode, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags, ApiCreatedResponse, ApiHeader } from '@nestjs/swagger'
import { RateLimitGuard } from '../auth/rate-limit.guard.js'
import { ApiPublicErrors } from '../config/api-error-responses.decorator.js'
import { CreatePublicReservationDto } from './dto/create-reservation.dto.js'
import { ReservationViewDto } from './dto/reservation-response.dto.js'
import { ReservationsService } from './reservations.service.js'

@ApiTags('public-reservations')
@ApiPublicErrors()
@Controller('public/reservations')
export class PublicReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @UseGuards(RateLimitGuard)
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a public reservation' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Unique key for safe retry of this submission',
  })
  @ApiCreatedResponse({ type: ReservationViewDto })
  async create(
    @Body() dto: CreatePublicReservationDto,
    @Headers('idempotency-key') idempotencyKey?: string
  ): Promise<ReservationView> {
    return this.reservationsService.createPublic(
      {
        source: 'website',
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        lines: dto.lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
        })),
      },
      idempotencyKey || null
    )
  }
}
