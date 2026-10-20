import { ApiProperty } from '@nestjs/swagger'

export class AdminTasteNoteResponse {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  id!: string

  @ApiProperty({ example: 'Цветочный' })
  name!: string

  @ApiProperty({ example: 'floral' })
  slug!: string

  @ApiProperty({ example: 10 })
  sortOrder!: number

  @ApiProperty({ example: '2026-01-05T00:00:00.000Z' })
  createdAt!: string

  @ApiProperty({ example: '2026-02-01T00:00:00.000Z' })
  updatedAt!: string

  @ApiProperty({ example: 7 })
  productsCount!: number
}

export class AdminTasteNotePaginationResponse {
  @ApiProperty({ example: 1 })
  page!: number

  @ApiProperty({ example: 20 })
  limit!: number

  @ApiProperty({ example: 12 })
  totalItems!: number

  @ApiProperty({ example: 1 })
  totalPages!: number
}

export class AdminTasteNoteListResponse {
  @ApiProperty({ type: [AdminTasteNoteResponse] })
  items!: AdminTasteNoteResponse[]

  @ApiProperty({ type: AdminTasteNotePaginationResponse })
  pagination!: AdminTasteNotePaginationResponse
}
