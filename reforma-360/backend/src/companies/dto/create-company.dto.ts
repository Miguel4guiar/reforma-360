import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CompanyTaxRegime {
  SIMPLES_NACIONAL = 'SIMPLES_NACIONAL',
  LUCRO_PRESUMIDO = 'LUCRO_PRESUMIDO',
  LUCRO_REAL = 'LUCRO_REAL',
  NAO_INFORMADO = 'NAO_INFORMADO',
}

export class CreateCompanyDto {
  @ApiProperty({ example: 'Empresa Demonstração Ltda' })
  @IsString() @Length(2, 160)
  name!: string;

  @ApiProperty({ example: '12345678000199', description: 'CNPJ com 14 dígitos, somente números' })
  @Matches(/^\d{14}$/, { message: 'taxId deve conter 14 dígitos numéricos' })
  taxId!: string;

  @ApiProperty({ enum: CompanyTaxRegime })
  @IsEnum(CompanyTaxRegime)
  taxRegime!: CompanyTaxRegime;

  @ApiProperty({ example: 'ID_DA_ORGANIZACAO' })
  @IsString() @Length(1, 64)
  organizationId!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @Length(2, 100)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @Length(2, 120)
  city?: string;
}
