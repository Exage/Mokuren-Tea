import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator'

export class CreateTasteNoteDto {
  @ApiProperty({ example: 'Цветочный' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  name!: string

  @ApiProperty({ example: 'floral' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  slug!: string

  @ApiPropertyOptional({ default: 0, example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number
}
