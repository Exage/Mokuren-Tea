import { ApiProperty } from '@nestjs/swagger'

export class TasteNoteUsagesResponse {
  @ApiProperty({ example: 7 })
  productsCount!: number
}
