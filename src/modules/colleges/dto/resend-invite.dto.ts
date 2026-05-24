import { IsEmail } from 'class-validator'

export class ResendInviteDto {
  @IsEmail()
  email: string
}
