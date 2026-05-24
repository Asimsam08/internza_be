import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class ApproveTaskDto {
  @IsString()
  @IsNotEmpty()
  taskId: string;

  @IsString()
  @IsOptional()
  feedback?: string;
}
