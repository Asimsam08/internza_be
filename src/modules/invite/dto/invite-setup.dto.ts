import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator'

export class InviteSetupDto {
  @IsOptional()
  @IsString()
  collegeId?: string

  @IsString()
  @IsNotEmpty()
  token: string

  @IsString()
  @MinLength(8)
  password: string
}
