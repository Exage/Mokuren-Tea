import { ApiProperty } from '@nestjs/swagger'

export class PublicCategoryResponse {
  @ApiProperty({ example: '64f000000000000000000000' })
  id!: string

  @ApiProperty({ example: 'Oolong' })
  name!: string

  @ApiProperty({ example: 'oolong' })
  slug!: string

  @ApiProperty({ example: 5 })
  sortOrder!: number
}

export class PublicCategoryListResponse {
  @ApiProperty({ type: [PublicCategoryResponse] })
  items!: PublicCategoryResponse[]
}
