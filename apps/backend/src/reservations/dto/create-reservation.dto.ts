import { ApiProperty, OmitType } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

export class ReservationLineDto {
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
  @Max(1000)
  quantity!: number
}

export class CreatePublicReservationDto {
  @ApiProperty({ example: 'website' })
  @IsIn(['website'])
  source!: 'website'

  @ApiProperty({ example: 'Anna Ivanova' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  customerName!: string

  @ApiProperty({ example: '+375291234567' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  customerPhone!: string

  @ApiProperty({ type: [ReservationLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ReservationLineDto)
  lines!: ReservationLineDto[]
}

export class CreateAdminReservationDto extends OmitType(CreatePublicReservationDto, [
  'source',
] as const) {}
