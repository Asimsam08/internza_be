import { IsString, IsOptional, IsArray, IsUrl, ArrayMinSize } from 'class-validator';

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
  @ArrayMinSize(5)
  @IsString({ each: true })
  screenshots: string[];
}
