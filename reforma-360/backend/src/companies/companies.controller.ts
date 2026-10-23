import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
@ApiTags('companies') @ApiBearerAuth() @UseGuards(AuthGuard) @Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}
  @Get() @ApiOperation({ summary: 'Lista empresas somente se o usuário pertencer à organização' }) list(@Req() req: Request & { user: { id: string } }, @Query('organizationId') organizationId: string) { return this.companiesService.list(req.user.id, organizationId); }
  @Post() @ApiOperation({ summary: 'Cadastra empresa somente em organização autorizada' }) create(@Req() req: Request & { user: { id: string } }, @Body() dto: CreateCompanyDto) { return this.companiesService.create(req.user.id, dto); }
}
