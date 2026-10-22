import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

export class AdminChangePasswordDto {
  @ApiProperty({ example: '********' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string

  @ApiProperty({ example: '********' })
  @IsString()
  @IsNotEmpty()
  newPassword!: string
}
