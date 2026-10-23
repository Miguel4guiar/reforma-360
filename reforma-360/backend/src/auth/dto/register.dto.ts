import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsString, Length, Matches, MinLength } from 'class-validator';
import { OrganizationTypeDto } from '../../organizations/dto/create-organization.dto';

export class RegisterDto {
  @ApiProperty({ example: 'Miguel Aguiar' }) @IsString() @Length(2, 120) name!: string;
  @ApiProperty({ example: 'miguel@empresa.com.br' }) @IsEmail() @Length(5, 180) email!: string;
  @ApiProperty({ example: 'SenhaForte123!' }) @IsString() @MinLength(10) @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'A senha deve conter letras e números.' }) password!: string;
  @ApiProperty({ example: 'Escritório Exemplo' }) @IsString() @Length(2, 160) organizationName!: string;
  @ApiProperty({ enum: OrganizationTypeDto }) @IsEnum(OrganizationTypeDto) organizationType!: OrganizationTypeDto;
}
