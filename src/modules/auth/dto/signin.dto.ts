import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsString } from 'class-validator'

export class SigninDto {
  @ApiProperty({ example: 'student@example.com' })
  @IsEmail()
  email: string

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  password: string
}
