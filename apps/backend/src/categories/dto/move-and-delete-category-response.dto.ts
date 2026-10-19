import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class MoveAndDeleteCategoryResponse {
  @ApiProperty({ example: '64f000000000000000000000' })
  deletedCategoryId!: string

  @ApiPropertyOptional({ example: '64f000000000000000000001', nullable: true })
  targetCategoryId!: string | null

  @ApiProperty({ example: 12 })
  movedProductsCount!: number
}
