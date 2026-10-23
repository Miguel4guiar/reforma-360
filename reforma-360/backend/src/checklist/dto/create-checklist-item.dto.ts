import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export enum ChecklistStatusDto {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}
export enum ChecklistPriorityDto {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export class CreateChecklistItemDto {
  @IsString() @MinLength(2) @MaxLength(180)
  title!: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

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
