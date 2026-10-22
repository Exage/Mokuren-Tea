import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, IsObject, MaxLength } from 'class-validator'

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

  @ApiPropertyOptional({ example: '+375291234567' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  phone?: string | null

  @ApiPropertyOptional({ example: { email: 'hello@mokuren.example' } })
  @IsOptional()
  @IsObject()
  contacts?: Record<string, unknown> | null
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

  @ApiPropertyOptional()
  phone!: string | null

  @ApiPropertyOptional()
  contacts!: Record<string, unknown> | null

  @ApiProperty()
  updatedAt!: string
}
