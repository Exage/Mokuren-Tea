import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsDateString, IsIn, IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator'

export class AdminInventoryMovementsQueryDto {
  @ApiPropertyOptional({ example: '64f000000000000000000000' })
  @IsOptional()
  @IsMongoId()
  productId?: string

  @ApiPropertyOptional({ example: 'receipt' })
  @IsOptional()
  @IsIn(['receipt', 'write-off', 'adjustment', 'compensation', 'reserve', 'complete', 'release'])
  type?:
    'receipt' | 'write-off' | 'adjustment' | 'compensation' | 'reserve' | 'complete' | 'release'

  @ApiPropertyOptional({ example: '64f000000000000000000000' })
  @IsOptional()
  @IsMongoId()
  reservationId?: string

  @ApiPropertyOptional({ example: '64f000000000000000000000' })
  @IsOptional()
  @IsMongoId()
  correctionOfId?: string

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  from?: string

  @ApiPropertyOptional({ example: '2026-01-31T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  to?: string

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}
