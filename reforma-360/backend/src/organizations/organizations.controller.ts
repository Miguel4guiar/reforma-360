import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';

@ApiTags('organizations') 
@ApiBearerAuth() 
@UseGuards(AuthGuard) 
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}
  
  @Get() 
  @ApiOperation({ summary: 'Lista apenas organizações do usuário autenticado' }) 
  list(@Req() req: Request & { user: { id: string } }) { 
    return this.organizationsService.list(req.user.id); 
  }
  
  @Post() 
  @ApiOperation({ summary: 'Cria organização e associa o usuário como proprietário' }) 
  create(@Req() req: Request & { user: { id: string } }, @Body() dto: CreateOrganizationDto) { 
    return this.organizationsService.create(req.user.id, dto); 
  }

  @Delete(':id/data')
  @ApiOperation({ summary: 'Limpa todos os dados da organização (XMLs e Simulações)' })
  clearData(@Req() req: Request & { user: { id: string } }, @Param('id') id: string) {
    return this.organizationsService.clearData(req.user.id, id);
  }
}