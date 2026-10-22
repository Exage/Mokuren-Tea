import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

export class UpdateReservationLineDto {
  @ApiProperty({ example: '64f000000000000000000000' })
  @IsMongoId()
  productId!: string

  @ApiProperty({ example: 'v_550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  @IsNotEmpty()
  variantId!: string

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity!: number
}

export class UpdateReservationDto {
  @ApiPropertyOptional({ type: [UpdateReservationLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateReservationLineDto)
  lines?: UpdateReservationLineDto[]

  @ApiPropertyOptional({ example: 'Anna Ivanova' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  customerName?: string | null

  @ApiPropertyOptional({ example: '+375291234567' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  customerPhone?: string | null
}
