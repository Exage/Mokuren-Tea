import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsMongoId, IsNotEmpty, IsNumber, IsObject, IsString, Min } from 'class-validator'
import {
  PublicImageResponse,
  PublicProductResponse,
} from '../../products/dto/public-product-response.dto.js'

export class SaveCmsDraftDto {
  @ApiProperty({ example: 'home' })
  @IsString()
  @IsNotEmpty()
  pageKey!: string

  @ApiProperty({ example: 'home.hero' })
  @IsString()
  @IsNotEmpty()
  blockKey!:
    | 'home.hero'
    | 'home.testimonials'
    | 'home.featuredTeas'
    | 'home.visitStore'
    | 'catalog.header'
    | 'about.content'
    | 'contacts.content'

  @ApiProperty({ example: { title: 'Welcome', subtitle: 'Fine tea' } })
  @IsObject()
  content!: Record<string, unknown>

  @ApiProperty({ example: 0 })
  @IsNumber()
  @Min(0)
  expectedDraftVersion!: number
}

export class PublishCmsBlockDto {
  @ApiProperty({ example: 'home' })
  @IsString()
  @IsNotEmpty()
  pageKey!: string

  @ApiProperty({ example: 'home.hero' })
  @IsString()
  @IsNotEmpty()
  blockKey!:
    | 'home.hero'
    | 'home.testimonials'
    | 'home.featuredTeas'
    | 'home.visitStore'
    | 'catalog.header'
    | 'about.content'
    | 'contacts.content'
}

export class RestoreCmsRevisionDto {
  @ApiProperty({ example: 'home' })
  @IsString()
  @IsNotEmpty()
  pageKey!: string

  @ApiProperty({ example: 'home.hero' })
  @IsString()
  @IsNotEmpty()
  blockKey!:
    | 'home.hero'
    | 'home.testimonials'
    | 'home.featuredTeas'
    | 'home.visitStore'
    | 'catalog.header'
    | 'about.content'
    | 'contacts.content'

  @ApiProperty({ example: '64f000000000000000000000' })
  @IsMongoId()
  revisionId!: string
}

export class CmsBlockDto {
  @ApiProperty()
  pageKey!: string

  @ApiProperty()
  blockKey!: string

  @ApiPropertyOptional()
  draft!: Record<string, unknown> | null

  @ApiProperty()
  draftVersion!: number

  @ApiPropertyOptional()
  published!: Record<string, unknown> | null

  @ApiProperty()
  publishedVersion!: number

  @ApiPropertyOptional()
  updatedBy!: string | null

  @ApiProperty()
  updatedAt!: string
}

export class CmsBlockListDto {
  @ApiProperty({ type: [CmsBlockDto] })
  items!: CmsBlockDto[]

  @ApiProperty({ example: { page: 1, limit: 100, totalItems: 7, totalPages: 1 } })
  pagination!: { page: number; limit: number; totalItems: number; totalPages: number }
}

export class CmsRevisionDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  pageKey!: string

  @ApiProperty()
  blockKey!: string

  @ApiProperty()
  version!: number

  @ApiProperty()
  content!: Record<string, unknown>

  @ApiPropertyOptional()
  publishedBy!: string | null

  @ApiProperty()
  publishedAt!: string
}

export class CmsRevisionListDto {
  @ApiProperty({ type: [CmsRevisionDto] })
  items!: CmsRevisionDto[]

  @ApiProperty()
  pagination!: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
}

export class CmsPagePreviewDto {
  @ApiProperty()
  pageKey!: string

  @ApiProperty()
  blocks!: Record<string, Record<string, unknown> | null>
}

export class PublishedCmsBlockDto {
  @ApiProperty({ type: Object, nullable: true })
  content!: Record<string, unknown> | null

  @ApiProperty()
  version!: number

  @ApiProperty({ type: PublicImageResponse, nullable: true })
  image!: PublicImageResponse | null

  @ApiProperty({ type: [PublicProductResponse] })
  products!: PublicProductResponse[]
}

export class PublishedCmsPageDto {
  @ApiProperty()
  pageKey!: string

  @ApiProperty({
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/PublishedCmsBlockDto' },
  })
  blocks!: Record<string, PublishedCmsBlockDto>
}
