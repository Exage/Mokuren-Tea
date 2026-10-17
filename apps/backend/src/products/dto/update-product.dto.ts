import { ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator'

// Partial card update. Status, slug, timestamps, stock counters and existing
// variantIds are intentionally absent: PATCH must never change them.
export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Milk Oolong Reserve' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  name?: string

  @ApiPropertyOptional({ example: 'Creamy Taiwanese oolong' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string

  @ApiPropertyOptional({ example: '64f000000000000000000000' })
  @IsOptional()
  @IsMongoId()
  categoryId?: string | null

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsMongoId({ each: true })
  tasteNoteIds?: string[]

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsMongoId({ each: true })
  imageIds?: string[]

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThresholdGrams?: number
}
