import { IsString, IsOptional, IsInt, IsUrl, MaxLength, Min, Max } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  university?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  gradYear?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsUrl()
  linkedIn?: string;

  @IsOptional()
  @IsUrl()
  github?: string;
}
