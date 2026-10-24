import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { TaxSimulationsService } from './tax-simulations.service';

@ApiTags('tax-simulations')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('tax-simulations')
export class TaxSimulationsController {
  constructor(private readonly service: TaxSimulationsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista simulações da organização autorizada' })
  list(@Req() req: Request & { user: { id: string } }, @Query('organizationId') organizationId: string) {
    return this.service.list(req.user.id, organizationId);
  }

  @Post()
  @ApiOperation({ summary: 'Calcula e salva uma simulação preliminar CBS/IBS manual' })
  create(@Req() req: Request & { user: { id: string } }, @Body() body: { organizationId: string; name: string; inputs: Record<string, unknown> }) {
    return this.service.create(req.user.id, body);
  }

  @Post('document')
  @ApiOperation({ summary: 'Calcula e salva uma simulação extraindo valores de uma NF-e' })
  createFromDocument(@Req() req: Request & { user: { id: string } }, @Body() body: { organizationId: string; documentId: string; name: string; inputs: Record<string, unknown> }) {
    return this.service.createFromDocument(req.user.id, body);
  }
}