import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsOptional,
  IsString,
  IsObject,
  MaxLength,
  ValidateNested,
  IsNumber,
  Min,
  Max,
} from 'class-validator'
import { Type } from 'class-transformer'

export class StoreLocationDto {
  @ApiProperty({ minimum: -85.0511, maximum: 85.0511 })
  @IsNumber()
  @Min(-85.0511)
  @Max(85.0511)
  latitude!: number

  @ApiProperty({ minimum: -180, maximum: 180 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number
}

export class UpdateStoreSettingsDto {
  @ApiPropertyOptional({ example: 'Mokuren Tea' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string | null

  @ApiPropertyOptional({ example: 'Fine teas since 2024' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  tagline?: string | null

  @ApiPropertyOptional({ example: '123 Tea Lane, City' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null

  @ApiPropertyOptional({ example: 'Mon-Fri 10:00-19:00' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  hours?: string | null

  @ApiPropertyOptional({
    example: 'Daily 10:00–20:00',
    description:
      'Compact opening hours for the footer and home visit section. Falls back to hours when unset.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  hoursShort?: string | null

  @ApiPropertyOptional({ example: '+375291234567' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  phone?: string | null

  @ApiPropertyOptional({ example: { email: 'hello@mokuren.example' } })
  @IsOptional()
  @IsObject()
  contacts?: Record<string, unknown> | null

  @ApiPropertyOptional({ type: StoreLocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StoreLocationDto)
  location?: StoreLocationDto | null
}

export class StoreSettingsDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  name!: string

  @ApiPropertyOptional()
  tagline!: string | null

  @ApiPropertyOptional()
  address!: string | null

  @ApiPropertyOptional()
  hours!: string | null

  @ApiPropertyOptional({ description: 'Compact opening hours; null uses full hours.' })
  hoursShort!: string | null

  @ApiPropertyOptional()
  phone!: string | null

  @ApiPropertyOptional()
  contacts!: Record<string, unknown> | null

  @ApiPropertyOptional({ type: StoreLocationDto })
  location!: StoreLocationDto | null

  @ApiProperty()
  updatedAt!: string
}
