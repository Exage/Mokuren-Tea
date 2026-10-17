import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { MEDIA_ASSET_STATUSES } from '../schemas/media-asset.schema.js'

export class MediaAssetsQueryDto {
  @ApiPropertyOptional({ example: 'oolong' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  search?: string

  @ApiPropertyOptional({ enum: [...MEDIA_ASSET_STATUSES], default: 'ready' })
  @IsOptional()
  @IsIn([...MEDIA_ASSET_STATUSES])
  status?: string

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}
