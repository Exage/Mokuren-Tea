import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import { CreateProductVariantDto } from './create-product-variant.dto.js'

// Draft creation requires only name + slug. Everything else stays optional
// until publication, which enforces category, photo and variant readiness.
export class CreateProductDto {
  @ApiProperty({ example: 'Milk Oolong' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  name!: string

  @ApiProperty({ example: 'milk-oolong' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be kebab-case with letters, digits and dashes',
  })
  slug!: string

  @ApiPropertyOptional({ example: 'Creamy Taiwanese oolong' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string

  @ApiPropertyOptional({ example: '64f000000000000000000000' })
  @IsOptional()
  @IsMongoId()
  categoryId?: string

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

  @ApiPropertyOptional({ type: [CreateProductVariantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants?: CreateProductVariantDto[]
}
