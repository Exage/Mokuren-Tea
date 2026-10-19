import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'

// Partial category update. Each field is optional by absence but not nullable;
// explicit null is rejected by the service. Unknown fields and an empty body
// are rejected by the validation pipe / service.
export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Oolong Reserve' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  name?: string

  @ApiPropertyOptional({ example: 'oolong-reserve' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  slug?: string

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number
}
