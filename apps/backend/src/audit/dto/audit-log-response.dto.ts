import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class AuditLogViewDto {
  @ApiProperty()
  id!: string

  @ApiPropertyOptional({ nullable: true })
  actorId!: string | null

  @ApiProperty()
  action!: string

  @ApiProperty()
  entityType!: string

  @ApiPropertyOptional({ nullable: true })
  entityId!: string | null

  @ApiPropertyOptional({ type: Object, nullable: true })
  changes!: Record<string, unknown> | null

  @ApiPropertyOptional({ type: Object, nullable: true })
  metadata!: Record<string, unknown> | null

  @ApiProperty()
  createdAt!: string
}

export class AuditLogListDto {
  @ApiProperty({ type: [AuditLogViewDto] })
  items!: AuditLogViewDto[]

  @ApiProperty({ example: { page: 1, limit: 50, totalItems: 1, totalPages: 1 } })
  pagination!: { page: number; limit: number; totalItems: number; totalPages: number }
}
