import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '@app/auth';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ operationId: 'healthCheck', summary: 'Health check' })
  healthCheck() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
