import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ProductStatus } from '../domain/product-status.js'

export class AdminVariantResponse {
  @ApiProperty({ example: 'v_01HXYZ' })
  variantId!: string

  @ApiProperty({ example: 50 })
  weightGrams!: number

  @ApiProperty({ example: 21.9, description: 'Price in BYN' })
  price!: number

  @ApiProperty({ example: true })
  enabled!: boolean
}

export class AdminStockResponse {
  @ApiProperty({ example: 500 })
  physicalGrams!: number

  @ApiProperty({ example: 150 })
  reservedGrams!: number

  @ApiProperty({ example: 350 })
  availableGrams!: number
}

export class AdminImageResponse {
  @ApiProperty({ example: '64f000000000000000000000' })
  id!: string

  @ApiProperty({ example: 'https://res.cloudinary.com/demo/image/upload/tea.jpg' })
  url!: string

  @ApiPropertyOptional({ example: 'Milk oolong leaves' })
  alt?: string

  @ApiPropertyOptional({ example: 800 })
  width?: number

  @ApiPropertyOptional({ example: 600 })
  height?: number
}

export class AdminProductResponse {
  @ApiProperty({ example: '64f000000000000000000000' })
  id!: string

  @ApiProperty({ example: 'Milk Oolong' })
  name!: string

  @ApiProperty({ example: 'milk-oolong' })
  slug!: string

  @ApiProperty({ example: 'Creamy Taiwanese oolong' })
  description!: string

  @ApiPropertyOptional({ example: '64f000000000000000000000', nullable: true })
  categoryId!: string | null

  @ApiProperty({ type: [String] })
  tasteNoteIds!: string[]

  @ApiProperty({ type: [String] })
  imageIds!: string[]

  @ApiProperty({ type: [AdminImageResponse] })
  images!: AdminImageResponse[]

  @ApiProperty({ type: [AdminVariantResponse] })
  variants!: AdminVariantResponse[]

  @ApiProperty({ enum: ['draft', 'published', 'archived'] })
  status!: ProductStatus

  @ApiProperty({ example: '2026-01-10T00:00:00.000Z', nullable: true })
  firstPublishedAt!: string | null

  @ApiProperty({ example: '2026-02-01T00:00:00.000Z', nullable: true })
  lastPublishedAt!: string | null

  @ApiProperty({ example: 50 })
  lowStockThresholdGrams!: number

  @ApiProperty({ type: AdminStockResponse })
  stock!: AdminStockResponse

  @ApiProperty({ example: '2026-01-05T00:00:00.000Z' })
  createdAt!: string

  @ApiProperty({ example: '2026-02-01T00:00:00.000Z' })
  updatedAt!: string
}

export class AdminPaginationResponse {
  @ApiProperty({ example: 1 })
  page!: number

  @ApiProperty({ example: 20 })
  limit!: number

  @ApiProperty({ example: 12 })
  totalItems!: number

  @ApiProperty({ example: 1 })
  totalPages!: number
}

export class AdminProductListResponse {
  @ApiProperty({ type: [AdminProductResponse] })
  items!: AdminProductResponse[]

  @ApiProperty({ type: AdminPaginationResponse })
  pagination!: AdminPaginationResponse
}
