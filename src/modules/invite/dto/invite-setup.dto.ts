import { IsNotEmpty, IsString, MinLength } from 'class-validator'

export class InviteSetupDto {
  @IsString()
  @IsNotEmpty()
  collegeId: string

  @IsString()
  @IsNotEmpty()
  token: string

  @IsString()
  @MinLength(8)
  password: string
}
