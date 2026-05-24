import { IsEmail } from 'class-validator'

export class InviteReviewerDto {
  @IsEmail()
  email: string
}
