import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsArray, IsInt, ArrayMinSize } from 'class-validator';

export class PublishTemplateDto {
  @ApiProperty({ description: 'Template ID to publish' })
  @IsString()
  @IsNotEmpty()
  templateId: string;
}
