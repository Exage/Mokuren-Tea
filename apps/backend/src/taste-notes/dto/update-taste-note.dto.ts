import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'

// Partial taste-note update. Each field is optional by absence but not
// nullable; explicit null is rejected by the service. Unknown fields and an
// empty body are rejected by the validation pipe / service.
export class UpdateTasteNoteDto {
  @ApiPropertyOptional({ example: 'Floral aroma' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  name?: string

  @ApiPropertyOptional({ example: 'floral-aroma' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  slug?: string

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number
}
