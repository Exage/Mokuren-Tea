import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export const CATALOG_SORTS = ['new', 'price-asc', 'price-desc'] as const

export type CatalogSort = (typeof CATALOG_SORTS)[number]

function toStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).filter((entry) => entry.length > 0)
  }

  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return Number.NaN
  }

  return parsed
}

export class ProductCatalogQueryDto {
  @ApiPropertyOptional({ example: 'oolong' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  category?: string

  @ApiPropertyOptional({ example: 'floral,creamy' })
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsMongoId({ each: true })
  tastes?: string[]

  @ApiPropertyOptional({ example: 10, description: 'Minimum enabled-variant price in BYN' })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  minPrice?: number

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  maxPrice?: number

  @ApiPropertyOptional({ example: 'milk' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string

  @ApiPropertyOptional({ enum: CATALOG_SORTS, default: 'new' })
  @IsOptional()
  @IsIn([...CATALOG_SORTS])
  sort?: CatalogSort

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional({ default: 16 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}
