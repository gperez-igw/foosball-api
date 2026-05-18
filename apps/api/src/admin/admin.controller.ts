import {
  Controller,
  Patch,
  Delete,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
  Req,
  HttpCode,
  UseGuards,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AdminOverrideService } from '@app/matches/services/admin-override.service.js';
import { AdminOverrideResultDto } from '@app/matches/dto/admin-override.dto.js';
import { Roles } from '@app/auth';
import { RolesGuard } from '@app/auth';
import type { JwtPayload } from '@app/auth';
import { DlqInspectorService } from '@app/events';

interface AuthRequest {
  user: JwtPayload;
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@UseGuards(RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminOverrideService: AdminOverrideService,
    private readonly dlqInspectorService: DlqInspectorService,
  ) {}

  @Patch('matches/:matchId/result')
  @ApiOperation({ operationId: 'adminOverrideResult', summary: 'Admin override match result (confirmed match)' })
  @ApiParam({ name: 'matchId', type: 'integer' })
  async adminOverrideResult(
    @Req() req: AuthRequest,
    @Param('matchId', ParseIntPipe) matchId: number,
    @Body() dto: AdminOverrideResultDto,
  ) {
    return this.adminOverrideService.overrideResult(matchId, req.user.sub, req.user.is_admin, dto);
  }

  @Delete('matches/:matchId')
  @HttpCode(204)
  @ApiOperation({ operationId: 'adminDeleteMatch', summary: 'Admin delete any match (including confirmed)' })
  @ApiParam({ name: 'matchId', type: 'integer' })
  async adminDeleteMatch(@Req() req: AuthRequest, @Param('matchId', ParseIntPipe) matchId: number) {
    return this.adminOverrideService.deleteMatch(matchId, req.user.sub, req.user.is_admin);
  }

  @Get('matches/:matchId/audit')
  @ApiOperation({ operationId: 'getMatchAuditLog', summary: 'Get audit log for a match (admin only)' })
  @ApiParam({ name: 'matchId', type: 'integer' })
  async getMatchAuditLog(@Req() req: AuthRequest, @Param('matchId', ParseIntPipe) matchId: number) {
    const data = await this.adminOverrideService.getAuditLog(matchId, req.user.is_admin);
    return { data };
  }

  @Get('dlq')
  @ApiOperation({ operationId: 'listDlqJobs', summary: 'List failed BullMQ jobs in DLQ (admin only)' })
  @ApiQuery({ name: 'queue', required: false, enum: ['matches', 'leaderboard', 'audit'] })
  async listDlqJobs(@Query('queue') queue?: string) {
    const data = await this.dlqInspectorService.listFailed(queue);
    return { data };
  }

  @Post('dlq/:jobId/retry')
  @ApiOperation({ operationId: 'retryDlqJob', summary: 'Retry a DLQ job (admin only)' })
  @ApiParam({ name: 'jobId', type: 'string' })
  async retryDlqJob(@Param('jobId') jobId: string, @Query('queue') queue?: string) {
    // Determine which queue to retry in; default to scanning all queues if not specified
    const targetQueue = queue ?? 'matches';
    try {
      await this.dlqInspectorService.retryJob(targetQueue, jobId);
    } catch (err: any) {
      if (err?.message?.includes('not found')) {
        throw new NotFoundException({ code: 'JOB_NOT_FOUND', message: `Job ${jobId} not found in DLQ` });
      }
      throw err;
    }
    return { jobId, status: 'requeued' };
  }
}
