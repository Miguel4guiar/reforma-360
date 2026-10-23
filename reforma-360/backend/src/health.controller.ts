import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Verifica se a API está funcionando' })
  getHealth() {
    return { status: 'ok', service: 'Reforma 360 API', version: '0.3.0', timestamp: new Date().toISOString() };
  }
}
