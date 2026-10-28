import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator'

export class AdminLoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'login must not be blank' })
  @MaxLength(300)
  login!: string

  @ApiProperty({ example: '********' })
  @IsString()
  @IsNotEmpty()
  password!: string
}
