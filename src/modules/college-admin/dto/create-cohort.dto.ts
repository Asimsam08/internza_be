import { IsArray, IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator'

export class CreateCohortDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsString()
  @IsNotEmpty()
  templateId: string

  @IsDateString()
  startDate: string

  @IsDateString()
  endDate: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  reviewerUserIds?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  inviteReviewerEmails?: string[]
}
