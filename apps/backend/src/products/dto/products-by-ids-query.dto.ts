import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { ArrayMaxSize, ArrayMinSize, IsArray, IsMongoId } from 'class-validator'

export class ProductsByIdsQueryDto {
  @ApiProperty({
    description:
      'Comma-separated product IDs. Only published products are returned, in request order.',
    example: '64f000000000000000000001,64f000000000000000000002',
    type: String,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').map((id) => id.trim()) : value
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  ids!: string[]
}
