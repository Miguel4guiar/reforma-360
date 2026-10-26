import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { FiscalDocumentsService } from './fiscal-documents.service';

@ApiTags('fiscal-documents')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('fiscal-documents')
export class FiscalDocumentsController {
  constructor(private readonly service: FiscalDocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista documentos fiscais da organização autorizada' })
  list(@Req() req: Request & { user: { id: string } }, @Query('organizationId') organizationId: string) {
    return this.service.list(req.user.id, organizationId);
  }

  @Post('import')
  @ApiOperation({ summary: 'Importa e extrai dados de um XML fiscal' })
  importXml(@Req() req: Request & { user: { id: string } }, @Body() body: { organizationId: string; fileName: string; xml: string }) {
    return this.service.importXml(req.user.id, body.organizationId, body.fileName, body.xml);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Apaga um documento fiscal específico' })
  remove(@Req() req: Request & { user: { id: string } }, @Param('id') id: string) {
    return this.service.remove(req.user.id, id);
  }
}