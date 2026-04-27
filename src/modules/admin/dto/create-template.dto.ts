import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsInt, IsEnum, IsNotEmpty, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export enum TemplateDifficulty {
  BEGINNER = 'Beginner',
  INTERMEDIATE = 'Intermediate',
  ADVANCED = 'Advanced',
}

export class TemplateTaskDto {
  @ApiProperty({ description: 'Task title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Task description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Task order within the template' })
  @IsInt()
  @IsNotEmpty()
  order: number;

  @ApiProperty({ description: 'Estimated days to complete this task' })
  @IsInt()
  @IsNotEmpty()
  durationDays: number;

  @ApiProperty({ description: 'Optional dependency on previous task ID', required: false })
  @IsString()
  @IsOptional()
  dependsOnTaskId?: string;
}

export class CreateTemplateDto {
  @ApiProperty({ description: 'Template title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Template description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Short description for cards' })
  @IsString()
  @IsOptional()
  shortDescription?: string;

  @ApiProperty({ description: 'Template category' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ description: 'Difficulty level', enum: TemplateDifficulty })
  @IsEnum(TemplateDifficulty)
  @IsNotEmpty()
  difficulty: TemplateDifficulty;

  @ApiProperty({ description: 'Duration in weeks' })
  @IsInt()
  @IsNotEmpty()
  duration: number;

  @ApiProperty({ description: 'Required skills', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  skills: string[];

  @ApiProperty({ description: 'Tech stack', type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  techStack?: string[];

  @ApiProperty({ description: 'Figma link', required: false })
  @IsString()
  @IsOptional()
  figmaLink?: string;

  @ApiProperty({ description: 'Image URL', required: false })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ description: 'Image public ID for Cloudinary', required: false })
  @IsString()
  @IsOptional()
  imagePublicId?: string;

  @ApiProperty({ description: 'Image alt text', required: false })
  @IsString()
  @IsOptional()
  imageAlt?: string;

  @ApiProperty({ description: 'Template tasks', type: [TemplateTaskDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateTaskDto)
  @IsOptional()
  tasks?: TemplateTaskDto[];
}
