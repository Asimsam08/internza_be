import { IsEmail, IsNotEmpty } from 'class-validator'

export class JoinWaitlistDto {
  @IsEmail({}, { message: 'Please enter a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string
}
