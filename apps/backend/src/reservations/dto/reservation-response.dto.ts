import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

import type { ReservationLineSnapshot } from '../reservations.types.js'

export class ReservationViewDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  number!: string

  @ApiProperty()
  source!: 'website' | 'admin'

  @ApiProperty()
  customerName!: string

  @ApiProperty()
  customerPhone!: string

  @ApiProperty()
  status!: 'new' | 'confirmed' | 'ready' | 'completed' | 'cancelled'

  @ApiProperty({ type: [Object] })
  lines!: ReservationLineSnapshot[]

  @ApiProperty()
  totalGrams!: number

  @ApiProperty()
  totalAmount!: number

  @ApiPropertyOptional()
  createdByAdminId!: string | null

  @ApiProperty()
  createdAt!: string

  @ApiProperty()
  updatedAt!: string
}

export class ReservationListItemDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  number!: string

  @ApiProperty()
  source!: 'website' | 'admin'

  @ApiProperty()
  customerName!: string

  @ApiProperty()
  customerPhone!: string

  @ApiProperty()
  status!: 'new' | 'confirmed' | 'ready' | 'completed' | 'cancelled'

  @ApiProperty()
  totalGrams!: number

  @ApiProperty()
  totalAmount!: number

  @ApiProperty()
  createdAt!: string
}

export class ReservationListDto {
  @ApiProperty({ type: [ReservationListItemDto] })
  items!: ReservationListItemDto[]

  @ApiProperty()
  pagination!: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
}

export class ReservationEventDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  action!: 'created' | 'edited' | 'status-changed'

  @ApiPropertyOptional()
  oldStatus!: string | null

  @ApiPropertyOptional()
  newStatus!: string | null

  @ApiPropertyOptional()
  changes!: Record<string, unknown> | null

  @ApiPropertyOptional()
  actorId!: string | null

  @ApiProperty()
  createdAt!: string
}
