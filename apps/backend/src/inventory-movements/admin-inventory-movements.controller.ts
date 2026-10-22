import type { AdminRequestUser } from '../auth/auth.types.js'
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { AdminAuthGuard } from '../auth/admin-auth.guard.js'
import { CsrfGuard } from '../auth/csrf.guard.js'
import { CurrentAdmin } from '../auth/current-admin.decorator.js'
import { ApiAdminErrors } from '../config/api-error-responses.decorator.js'
import { InventoryMovementsService } from './inventory-movements.service.js'
import {
  ReceiveInventoryDto,
  WriteOffInventoryDto,
  AdjustInventoryDto,
  CompensateInventoryDto,
} from './dto/inventory-movement.dto.js'
import { AdminInventoryMovementsQueryDto } from './dto/admin-inventory-movements-query.dto.js'
import {
  MovementResultDto,
  InventoryMovementsListDto,
  ProductStockDto,
} from './dto/inventory-movement-response.dto.js'

@ApiTags('admin-inventory-movements')
@ApiAdminErrors()
@ApiBearerAuth()
@ApiCookieAuth('admin_session')
@ApiHeader({
  name: 'Idempotency-Key',
  required: false,
  description: 'Unique key for safe retry of a stock mutation',
})
@Controller('admin/inventory')
export class AdminInventoryMovementsController {
  constructor(private readonly inventoryMovementsService: InventoryMovementsService) {}

  @Post('receipt')
  @UseGuards(AdminAuthGuard, CsrfGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Record stock receipt (increases physical grams)' })
  @ApiOkResponse({ type: MovementResultDto })
  receipt(
    @Body() dto: ReceiveInventoryDto,
    @CurrentAdmin() admin?: AdminRequestUser,
    @Headers('idempotency-key') idempotencyKey?: string
  ): Promise<MovementResultDto> {
    return this.inventoryMovementsService.receipt(
      dto.productId,
      dto.grams,
      admin?.adminId ?? null,
      dto.reason ?? null,
      idempotencyKey || null
    )
  }

  @Post('write-off')
  @UseGuards(AdminAuthGuard, CsrfGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Write off unreserved stock (decreases physical grams)' })
  @ApiOkResponse({ type: MovementResultDto })
  writeOff(
    @Body() dto: WriteOffInventoryDto,
    @CurrentAdmin() admin?: AdminRequestUser,
    @Headers('idempotency-key') idempotencyKey?: string
  ): Promise<MovementResultDto> {
    return this.inventoryMovementsService.writeOff(
      dto.productId,
      dto.grams,
      admin?.adminId ?? null,
      dto.reason ?? null,
      idempotencyKey || null
    )
  }

  @Post('adjust')
  @UseGuards(AdminAuthGuard, CsrfGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Adjust physical stock to an explicit target' })
  @ApiOkResponse({ type: MovementResultDto })
  adjust(
    @Body() dto: AdjustInventoryDto,
    @CurrentAdmin() admin?: AdminRequestUser,
    @Headers('idempotency-key') idempotencyKey?: string
  ): Promise<MovementResultDto> {
    return this.inventoryMovementsService.adjust(
      dto.productId,
      dto.targetPhysicalGrams,
      admin?.adminId ?? null,
      dto.reason ?? null,
      idempotencyKey || null
    )
  }

  @Post('compensate')
  @UseGuards(AdminAuthGuard, CsrfGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Compensate an erroneous movement' })
  @ApiOkResponse({ type: MovementResultDto })
  compensate(
    @Body() dto: CompensateInventoryDto,
    @CurrentAdmin() admin?: AdminRequestUser,
    @Headers('idempotency-key') idempotencyKey?: string
  ): Promise<MovementResultDto> {
    return this.inventoryMovementsService.compensate(
      dto.movementId,
      admin?.adminId ?? null,
      dto.reason ?? null,
      idempotencyKey || null
    )
  }

  @Get('movements')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'List inventory movements with filters and pagination' })
  @ApiOkResponse({ type: InventoryMovementsListDto })
  list(@Query() query: AdminInventoryMovementsQueryDto): Promise<InventoryMovementsListDto> {
    return this.inventoryMovementsService.listMovements({
      productId: query.productId,
      type: query.type,
      reservationId: query.reservationId,
      correctionOfId: query.correctionOfId,
      from: query.from,
      to: query.to,
      page: query.page,
      limit: query.limit,
    })
  }

  @Get(':productId/stock')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Read stock levels for a product (admin, exact grams)' })
  @ApiOkResponse({ type: ProductStockDto })
  stock(@Param('productId') productId: string): Promise<ProductStockDto> {
    return this.inventoryMovementsService.getStock(productId).then((stock) => ({
      productId,
      physicalGrams: stock?.physicalGrams ?? 0,
      reservedGrams: stock?.reservedGrams ?? 0,
      availableGrams: stock?.availableGrams ?? 0,
    }))
  }
}
