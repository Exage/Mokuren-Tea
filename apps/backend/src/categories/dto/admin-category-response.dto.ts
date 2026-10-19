import { ApiProperty } from '@nestjs/swagger'

export class AdminCategoryResponse {
  @ApiProperty({ example: '64f000000000000000000000' })
  id!: string

  @ApiProperty({ example: 'Oolong' })
  name!: string

  @ApiProperty({ example: 'oolong' })
  slug!: string

  @ApiProperty({ example: 5 })
  sortOrder!: number

  @ApiProperty({ example: '2026-01-05T00:00:00.000Z' })
  createdAt!: string

  @ApiProperty({ example: '2026-02-01T00:00:00.000Z' })
  updatedAt!: string

  @ApiProperty({ example: 0 })
  productsCount!: number
}

export class AdminCategoryPaginationResponse {
  @ApiProperty({ example: 1 })
  page!: number

  @ApiProperty({ example: 20 })
  limit!: number

  @ApiProperty({ example: 12 })
  totalItems!: number

  @ApiProperty({ example: 1 })
  totalPages!: number
}

export class AdminCategoryListResponse {
  @ApiProperty({ type: [AdminCategoryResponse] })
  items!: AdminCategoryResponse[]

  @ApiProperty({ type: AdminCategoryPaginationResponse })
  pagination!: AdminCategoryPaginationResponse
}
