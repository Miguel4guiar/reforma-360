import { IsEnum, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum OrganizationTypeDto {
  ACCOUNTING_FIRM = 'ACCOUNTING_FIRM',
  COMPANY = 'COMPANY',
  TAX_DEPARTMENT = 'TAX_DEPARTMENT',
}

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Escritório Exemplo Contábil' })
  @IsString() @Length(2, 160)
  name!: string;

  @ApiProperty({ enum: OrganizationTypeDto, example: 'ACCOUNTING_FIRM' })
  @IsEnum(OrganizationTypeDto)
  type!: OrganizationTypeDto;
}
