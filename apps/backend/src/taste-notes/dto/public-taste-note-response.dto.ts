import { ApiProperty } from '@nestjs/swagger'

export class PublicTasteNoteResponse {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  id!: string

  @ApiProperty({ example: 'Floral' })
  name!: string

  @ApiProperty({ example: 'floral' })
  slug!: string

  @ApiProperty({ example: 10 })
  sortOrder!: number
}

export class PublicTasteNoteListResponse {
  @ApiProperty({ type: [PublicTasteNoteResponse] })
  items!: PublicTasteNoteResponse[]
}
