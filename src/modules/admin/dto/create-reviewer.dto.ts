import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator'

export class CreateReviewerDto {
  @ApiProperty({ example: 'Jane Smith', description: 'Full name of the reviewer' })
  @IsString()
  @IsNotEmpty()
  fullName: string

  @ApiProperty({ example: 'reviewer@example.com', description: 'Reviewer email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiProperty({ example: 'SecurePass123!', description: 'Password (min 8 characters)' })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password: string
}
