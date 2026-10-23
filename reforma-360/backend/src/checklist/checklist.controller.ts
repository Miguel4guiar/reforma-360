import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { ChecklistService } from './checklist.service';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';

@ApiTags('checklist')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('checklist')
export class ChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Get()
  @ApiOperation({ summary: 'Lista tarefas de uma organização autorizada' })
  list(@Req() req: Request & { user: { id: string } }, @Query('organizationId') organizationId: string, @Query('companyId') companyId?: string, @Query('status') status?: string) {
    return this.checklistService.list(req.user.id, organizationId, companyId, status);
  }

  @Post()
  @ApiOperation({ summary: 'Cria tarefa no checklist de uma organização autorizada' })
  create(@Req() req: Request & { user: { id: string } }, @Query('organizationId') organizationId: string, @Body() dto: CreateChecklistItemDto) {
    return this.checklistService.create(req.user.id, organizationId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza tarefa pertencente a uma organização autorizada' })
  update(@Req() req: Request & { user: { id: string } }, @Param('id') id: string, @Body() dto: UpdateChecklistItemDto) {
    return this.checklistService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove tarefa pertencente a uma organização autorizada' })
  remove(@Req() req: Request & { user: { id: string } }, @Param('id') id: string) {
    return this.checklistService.remove(req.user.id, id);
  }
}
