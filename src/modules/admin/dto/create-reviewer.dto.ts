import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsNotEmpty, IsString } from 'class-validator'

export class CreateReviewerDto {
  @ApiProperty({ example: 'Jane Smith', description: 'Full name of the reviewer' })
  @IsString()
  @IsNotEmpty()
  fullName: string

  @ApiProperty({ example: 'reviewer@example.com', description: 'Reviewer email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string
}
