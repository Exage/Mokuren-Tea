import { ApiProperty } from '@nestjs/swagger'
import { IsInt, IsMongoId, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator'

export class ReceiveInventoryDto {
  @ApiProperty()
  @IsMongoId()
  productId!: string

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  grams!: number

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string
}

export class WriteOffInventoryDto extends ReceiveInventoryDto {}

export class AdjustInventoryDto {
  @ApiProperty()
  @IsMongoId()
  productId!: string

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  targetPhysicalGrams!: number

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string
}

export class CompensateInventoryDto {
  @ApiProperty()
  @IsMongoId()
  movementId!: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string
}
