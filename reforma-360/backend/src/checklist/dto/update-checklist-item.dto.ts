import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ChecklistPriorityDto, ChecklistStatusDto } from './create-checklist-item.dto';

export class UpdateChecklistItemDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(180)
  title?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string | null;

  @IsOptional() @IsString() @MaxLength(80)
  category?: string;

  @IsOptional() @IsString()
  companyId?: string | null;

  @IsOptional() @IsEnum(ChecklistStatusDto)
  status?: ChecklistStatusDto;

  @IsOptional() @IsEnum(ChecklistPriorityDto)
  priority?: ChecklistPriorityDto;

  @IsOptional() @IsDateString()
  dueDate?: string | null;

  @IsOptional() @IsString() @MaxLength(160)
  responsible?: string | null;

  @IsOptional() @IsString() @MaxLength(500)
  evidenceUrl?: string | null;
}
