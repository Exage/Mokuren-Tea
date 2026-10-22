import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateAdminUserDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(300)
  email!: string

  @ApiProperty({ example: 'Administrator' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  displayName!: string
}

export class UpdateAdminUserDto {
  @ApiPropertyOptional({ example: 'Administrator' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  displayName?: string

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
