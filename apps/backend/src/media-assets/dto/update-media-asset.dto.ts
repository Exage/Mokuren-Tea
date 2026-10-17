import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator'

// Status, usageCount and Cloudinary
// identifiers are managed exclusively by the service.
export class UpdateMediaAssetDto {
  @ApiPropertyOptional({ example: 'Milk oolong tea' })
  @IsOptional()
  @IsString()
  @Matches(/\S/, { message: 'name must not be empty' })
  @MaxLength(255)
  name?: string

  @ApiPropertyOptional({ example: 'Milk oolong leaves in a porcelain gaiwan' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  alt?: string
}
