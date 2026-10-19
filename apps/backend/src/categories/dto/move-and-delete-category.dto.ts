import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsMongoId, IsOptional } from 'class-validator'

// The target is optional by absence (allowed when the source is empty) but not
// nullable: an explicit null is invalid input.
export class MoveAndDeleteCategoryDto {
  @ApiPropertyOptional({ example: '64f000000000000000000001' })
  @IsOptional()
  @IsMongoId()
  targetCategoryId?: string
}
