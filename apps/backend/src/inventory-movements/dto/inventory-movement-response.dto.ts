import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

import type { StockSnapshot } from '../inventory-movements.types.js'

export class InventoryMovementResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  productId!: string

  @ApiProperty()
  type!:
    'receipt' | 'write-off' | 'adjustment' | 'compensation' | 'reserve' | 'complete' | 'release'

  @ApiProperty()
  before!: StockSnapshot

  @ApiProperty()
  delta!: StockSnapshot

  @ApiProperty()
  after!: StockSnapshot

  @ApiPropertyOptional()
  reason!: string | null

  @ApiPropertyOptional()
  reservationId!: string | null

  @ApiPropertyOptional()
  correctionOfId!: string | null

  @ApiPropertyOptional()
  actorId!: string | null

  @ApiProperty()
  createdAt!: string
}

export class MovementResultDto {
  @ApiProperty()
  movementId!: string

  @ApiProperty()
  stock!: {
    physicalGrams: number
    reservedGrams: number
    availableGrams: number
  }
}

export class InventoryMovementsListDto {
  @ApiProperty({ type: [InventoryMovementResponseDto] })
  items!: InventoryMovementResponseDto[]

  @ApiProperty()
  pagination!: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
}

export class ProductStockDto {
  @ApiProperty()
  productId!: string

  @ApiProperty()
  physicalGrams!: number

  @ApiProperty()
  reservedGrams!: number

  @ApiProperty()
  availableGrams!: number
}
