import { IsString, IsOptional, IsArray, IsUrl } from 'class-validator';

export class SubmitTaskDto {
  @IsString()
  taskId: string;

  @IsString()
  @IsUrl()
  prLink: string;

  @IsString()
  @IsOptional()
  commitHash?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  screenshots?: string[];
}
