import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

// Public storefront contracts. Exact gram counters are deliberately absent:
// only per-variant and aggregate availability booleans are exposed.
export class PublicVariantResponse {
  @ApiProperty({ example: 'v_01HXYZ' })
  variantId!: string

  @ApiProperty({ example: 50 })
  weightGrams!: number

  @ApiProperty({ example: 21.9, description: 'Price in BYN' })
  price!: number

  @ApiProperty({ example: true })
  available!: boolean
}

export class PublicImageResponse {
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

export class PublicProductResponse {
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

  @ApiProperty({ type: [PublicImageResponse] })
  images!: PublicImageResponse[]

  @ApiProperty({ type: [PublicVariantResponse] })
  variants!: PublicVariantResponse[]

  @ApiProperty({
    example: 21.9,
    nullable: true,
    description: 'Lowest enabled variant price in BYN',
  })
  minPrice!: number | null

  @ApiProperty({ example: false })
  outOfStock!: boolean

  @ApiProperty({ example: '2026-01-10T00:00:00.000Z', nullable: true })
  firstPublishedAt!: string | null
}

export class PaginationResponse {
  @ApiProperty({ example: 1 })
  page!: number

  @ApiProperty({ example: 16 })
  limit!: number

  @ApiProperty({ example: 47 })
  totalItems!: number

  @ApiProperty({ example: 3 })
  totalPages!: number
}

export class PublicProductListResponse {
  @ApiProperty({ type: [PublicProductResponse] })
  items!: PublicProductResponse[]

  @ApiProperty({ type: PaginationResponse })
  pagination!: PaginationResponse
}
