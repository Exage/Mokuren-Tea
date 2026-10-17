import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class MediaAssetResponse {
  @ApiProperty({ example: '64f000000000000000000000' })
  id!: string

  @ApiProperty({ example: 'image' })
  kind!: string

  @ApiProperty({ example: 'ready' })
  status!: string

  @ApiProperty({ example: 'https://res.cloudinary.com/demo/image/upload/tea.jpg', nullable: true })
  url!: string | null

  @ApiProperty({ example: 'oolong.jpg' })
  originalName!: string

  @ApiProperty({ example: 'Milk oolong tea' })
  name!: string

  @ApiProperty({ example: 'jpg', nullable: true })
  format!: string | null

  @ApiProperty({ example: 'image/jpeg', nullable: true })
  mimeType!: string | null

  @ApiProperty({ example: 41200, nullable: true })
  sizeBytes!: number | null

  @ApiProperty({ example: 1200, nullable: true })
  width!: number | null

  @ApiProperty({ example: 800, nullable: true })
  height!: number | null

  @ApiPropertyOptional({ example: 'Milk oolong leaves' })
  alt!: string

  @ApiProperty({ example: 2 })
  usageCount!: number

  @ApiProperty({ example: '2026-01-05T00:00:00.000Z' })
  createdAt!: string

  @ApiProperty({ example: '2026-02-01T00:00:00.000Z' })
  updatedAt!: string
}

export class MediaAssetListResponse {
  @ApiProperty({ type: [MediaAssetResponse] })
  items!: MediaAssetResponse[]

  @ApiProperty({
    example: { page: 1, limit: 20, totalItems: 12, totalPages: 1 },
  })
  pagination!: { page: number; limit: number; totalItems: number; totalPages: number }
}

export class MediaAssetUsageResponse {
  @ApiProperty({ example: '64f000000000000000000000' })
  id!: string

  @ApiProperty({ example: 'Milk Oolong' })
  name!: string

  @ApiProperty({ example: 'milk-oolong' })
  slug!: string

  @ApiProperty({ example: 'published' })
  status!: string
}
