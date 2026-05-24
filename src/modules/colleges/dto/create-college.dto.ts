import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator'

export class CreateCollegeDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9.-]+\.[a-z]{2,}$/i, { message: 'Domain must be a valid domain (e.g. vnit.ac.in)' })
  domain: string

  @IsEmail()
  primaryAdminEmail: string
}
