import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { LeaderboardService } from '@app/leaderboard/leaderboard.service';
import { LeaderboardQueryDto } from '@app/leaderboard/dto/leaderboard-query.dto';

@ApiTags('leaderboard')
@ApiBearerAuth()
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('users')
  @ApiOperation({ operationId: 'getLeaderboardUsers', summary: 'User win leaderboard with time filter' })
  async getLeaderboardUsers(@Query() query: LeaderboardQueryDto, @Res({ passthrough: true }) res: FastifyReply) {
    const filter = query.filter ?? 'total';
    const limit = query.limit ?? 20;
    const result = await this.leaderboardService.getUserLeaderboard(filter, limit);
    res.header('X-Cache', result.cacheStatus);
    return { filter: result.filter, data: result.data, generatedAt: result.generatedAt };
  }

  @Get('pairs')
  @ApiOperation({ operationId: 'getLeaderboardPairs', summary: 'Pair win leaderboard with time filter' })
  async getLeaderboardPairs(@Query() query: LeaderboardQueryDto, @Res({ passthrough: true }) res: FastifyReply) {
    const filter = query.filter ?? 'total';
    const limit = query.limit ?? 20;
    const result = await this.leaderboardService.getPairLeaderboard(filter, limit);
    res.header('X-Cache', result.cacheStatus);
    return { filter: result.filter, data: result.data, generatedAt: result.generatedAt };
  }
}
