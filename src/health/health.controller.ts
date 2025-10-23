import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { ApiTags, ApiOkResponse } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}
  @Get()
  @ApiOkResponse({ description: 'Simple readiness check' })
  getHealth() {
    return { status: 'ok' };
  }

  // Public: detailed multi-check snapshot
  @Get('status')
  @ApiOkResponse({ description: 'Detailed service health snapshot' })
  async getStatus() {
    return this.health.getStatusSnapshot();
  }
}
