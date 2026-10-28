import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

// Safe view of an administrator. No password hash, session token, cookie, or
// temporary password is ever exposed here.
export class AdminUserDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  id!: string

  @ApiProperty({ example: 'admin' })
  login!: string

  @ApiProperty({ example: 'Administrator' })
  displayName!: string

  @ApiProperty({ example: true })
  isActive!: boolean

  @ApiPropertyOptional({ default: false })
  mustChangePassword!: boolean

  @ApiProperty({ example: '2026-01-05T00:00:00.000Z' })
  createdAt!: string

  @ApiProperty({ example: '2026-02-01T00:00:00.000Z' })
  updatedAt!: string

  @ApiPropertyOptional({ example: '2026-02-01T10:00:00.000Z' })
  lastLoginAt!: string | null
}

export class AdminUserPaginationResponse {
  @ApiProperty({ example: 1 })
  page!: number

  @ApiProperty({ example: 20 })
  limit!: number

  @ApiProperty({ example: 12 })
  totalItems!: number

  @ApiProperty({ example: 1 })
  totalPages!: number
}

export class AdminUserListResponse {
  @ApiProperty({ type: [AdminUserDto] })
  items!: AdminUserDto[]

  @ApiProperty({ type: AdminUserPaginationResponse })
  pagination!: AdminUserPaginationResponse
}

// Returned by create and reset-password. The temporary password is included
// only when one is server-generated (create/reset by another administrator);
// it is never returned when the administrator set their own password, never
// returned by list or detail endpoints, and is never stored in plaintext.
export class AdminUserCreateResponse {
  @ApiProperty({ type: AdminUserDto })
  user!: AdminUserDto

  @ApiPropertyOptional({ example: 'xK9#mP2vL8nQ' })
  temporaryPassword?: string

  @ApiPropertyOptional({ example: '2026-02-02T10:00:00.000Z' })
  temporaryPasswordExpiresAt?: string
}
