import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator'

export class CreateProductVariantDto {
  @ApiProperty({ example: 50 })
  @IsInt()
  @Min(1)
  weightGrams!: number

  @ApiProperty({ example: 21.9, description: 'Price in BYN' })
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1_000_000)
  price!: number

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean
}
