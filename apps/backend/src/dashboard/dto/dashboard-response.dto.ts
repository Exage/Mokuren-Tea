import { ApiProperty } from '@nestjs/swagger'

class DashboardReservationCountsDto {
  @ApiProperty()
  new!: number

  @ApiProperty()
  confirmed!: number

  @ApiProperty()
  ready!: number
}

class ProblematicProductDto {
  @ApiProperty()
  productId!: string

  @ApiProperty()
  productName!: string

  @ApiProperty()
  availableGrams!: number

  @ApiProperty({ enum: ['low-stock', 'out-of-stock'] })
  issue!: 'low-stock' | 'out-of-stock'
}

class DashboardStockDto {
  @ApiProperty()
  lowStockProducts!: number

  @ApiProperty()
  outOfStockProducts!: number

  @ApiProperty({ type: [ProblematicProductDto] })
  problematicProducts!: ProblematicProductDto[]
}

class RecentReservationDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  number!: string

  @ApiProperty()
  customerName!: string

  @ApiProperty({ enum: ['new', 'confirmed', 'ready'] })
  status!: 'new' | 'confirmed' | 'ready'

  @ApiProperty()
  totalGrams!: number

  @ApiProperty()
  createdAt!: string
}

export class DashboardViewDto {
  @ApiProperty({ type: DashboardReservationCountsDto })
  reservations!: DashboardReservationCountsDto

  @ApiProperty({ type: DashboardStockDto })
  stock!: DashboardStockDto

  @ApiProperty({ type: [RecentReservationDto] })
  recentReservations!: RecentReservationDto[]
}
