import { ApiProperty } from '@nestjs/swagger'
import { Role } from '@prisma/client'

export class AuthResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken: string

  @ApiProperty({ example: 'STUDENT' })
  role: Role

  @ApiProperty({ example: 'user-uuid' })
  userId: string
}
