import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

export class AdminLoginDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsString()
  @IsNotEmpty()
  email!: string

  @ApiProperty({ example: '********' })
  @IsString()
  @IsNotEmpty()
  password!: string
}
