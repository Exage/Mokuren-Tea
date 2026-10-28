import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator'

export class CreateAdminUserDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @Matches(/\S/, { message: 'login must not be blank' })
  login!: string

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
