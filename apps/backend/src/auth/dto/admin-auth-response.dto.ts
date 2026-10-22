import { ApiProperty } from '@nestjs/swagger'

// Safe view of an administrator: no password hash, session token, or cookie
// value is ever exposed.
export class AdminUserResponse {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  id!: string

  @ApiProperty({ example: 'admin@example.com' })
  email!: string

  @ApiProperty({ example: 'Administrator' })
  displayName!: string

  @ApiProperty({ default: false })
  mustChangePassword!: boolean
}

export class AdminAuthResponse {
  @ApiProperty({ type: AdminUserResponse })
  user!: AdminUserResponse

  @ApiProperty({ example: false })
  mustChangePassword!: boolean
}
