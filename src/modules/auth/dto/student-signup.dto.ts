import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsString, MinLength, IsNumber, IsNotEmpty } from 'class-validator'

export class StudentSignupDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name of the student' })
  @IsString()
  @IsNotEmpty()
  fullName: string

  @ApiProperty({ example: 'student@example.com', description: 'Student email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiProperty({ example: 'MIT', description: 'University name' })
  @IsString()
  @IsNotEmpty()
  university: string

  @ApiProperty({ example: 2025, description: 'Graduation year' })
  @IsNumber()
  @IsNotEmpty()
  graduationYear: number

  @ApiProperty({ example: 'SecurePass123!', description: 'Password (min 8 characters)' })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password: string
}
