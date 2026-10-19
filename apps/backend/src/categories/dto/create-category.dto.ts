import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator'

export class CreateCategoryDto {
  @ApiProperty({ example: 'Oolong' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  name!: string

  @ApiProperty({ example: 'oolong' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  slug!: string

  @ApiPropertyOptional({ default: 0, example: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number
}
