import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class AdminReservationsQueryDto {
  @ApiPropertyOptional({ example: 'new' })
  @IsOptional()
  @IsIn(['new', 'confirmed', 'ready', 'completed', 'cancelled'])
  status?: 'new' | 'confirmed' | 'ready' | 'completed' | 'cancelled'

  @ApiPropertyOptional({ example: 'website' })
  @IsOptional()
  @IsIn(['website', 'admin'])
  source?: 'website' | 'admin'

  @ApiPropertyOptional({ example: 'Anna' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customerName?: string

  @ApiPropertyOptional({ example: '+375291234567' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  customerPhone?: string

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

export class CancelReservationDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  teaReturned?: boolean
}
