import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator'

// Only weight, price and the enabled flag may change. variantId of an
// existing variant is stable and never accepted here.
export class UpdateProductVariantDto {
  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  weightGrams?: number

  @ApiPropertyOptional({ example: 39.9, description: 'Price in BYN' })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1_000_000)
  price?: number

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean
}
