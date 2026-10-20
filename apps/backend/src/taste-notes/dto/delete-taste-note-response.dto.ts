import { ApiProperty } from '@nestjs/swagger'

export class DeleteTasteNoteResponse {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  deletedTasteNoteId!: string

  @ApiProperty({ example: 7 })
  affectedProductsCount!: number
}
