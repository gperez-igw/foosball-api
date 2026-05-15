import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  Req,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiSecurity,
  ApiParam,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MatchService } from '@app/matches/services/match.service.js';
import { ConfirmationService } from '@app/matches/services/confirmation.service.js';
import { AdminOverrideService } from '@app/matches/services/admin-override.service.js';
import { CreateMatchDto } from '@app/matches/dto/create-match.dto.js';
import { UpdateMatchDto } from '@app/matches/dto/update-match.dto.js';
import { AddPlayersDto } from '@app/matches/dto/add-players.dto.js';
import { SubmitResultDto } from '@app/matches/dto/submit-result.dto.js';
import { ListMatchesDto } from '@app/matches/dto/list-matches.dto.js';
import { AdminOverrideResultDto } from '@app/matches/dto/admin-override.dto.js';
import { Roles } from '@app/auth';
import { RolesGuard } from '@app/auth';
import type { JwtPayload } from '@app/auth';

interface AuthRequest {
  user: JwtPayload;
}

@ApiTags('matches')
@ApiBearerAuth()
@Controller('matches')
export class MatchesController {
  constructor(
    private readonly matchService: MatchService,
    private readonly confirmationService: ConfirmationService,
  ) {}

  @Post()
  @ApiOperation({ operationId: 'createMatch', summary: 'Create a new match' })
  async createMatch(@Req() req: AuthRequest, @Body() dto: CreateMatchDto) {
    return this.matchService.create(req.user.sub, dto);
  }

  @Get()
  @ApiOperation({ operationId: 'listMatches', summary: 'List matches (cursor-based pagination)' })
  async listMatches(@Query() query: ListMatchesDto) {
    return this.matchService.list(query);
  }

  @Get(':matchId')
  @ApiOperation({ operationId: 'getMatch', summary: 'Get match detail' })
  @ApiParam({ name: 'matchId', type: 'integer' })
  async getMatch(@Param('matchId', ParseIntPipe) matchId: number) {
    return this.matchService.findById(matchId);
  }

  @Patch(':matchId')
  @ApiOperation({ operationId: 'updateMatch', summary: 'Update match' })
  @ApiParam({ name: 'matchId', type: 'integer' })
  async updateMatch(
    @Req() req: AuthRequest,
    @Param('matchId', ParseIntPipe) matchId: number,
    @Body() dto: UpdateMatchDto,
  ) {
    return this.matchService.update(matchId, req.user.sub, dto);
  }

  @Delete(':matchId')
  @HttpCode(204)
  @ApiOperation({ operationId: 'deleteMatch', summary: 'Delete match (admin only)' })
  @ApiParam({ name: 'matchId', type: 'integer' })
  @Roles('admin')
  @UseGuards(RolesGuard)
  async deleteMatch(@Req() req: AuthRequest, @Param('matchId', ParseIntPipe) matchId: number) {
    return this.matchService.delete(matchId, req.user.sub, req.user.is_admin);
  }

  @Post(':matchId/players')
  @ApiOperation({ operationId: 'addPlayers', summary: 'Add players to a match' })
  @ApiParam({ name: 'matchId', type: 'integer' })
  async addPlayers(
    @Req() req: AuthRequest,
    @Param('matchId', ParseIntPipe) matchId: number,
    @Body() dto: AddPlayersDto,
  ) {
    return this.matchService.addPlayers(matchId, req.user.sub, dto);
  }

  @Post(':matchId/result')
  @ApiOperation({ operationId: 'submitResult', summary: 'Submit match result' })
  @ApiParam({ name: 'matchId', type: 'integer' })
  async submitResult(
    @Req() req: AuthRequest,
    @Param('matchId', ParseIntPipe) matchId: number,
    @Body() dto: SubmitResultDto,
  ) {
    return this.matchService.submitResult(matchId, req.user.sub, dto);
  }

  @Get(':matchId/confirmations')
  @ApiOperation({ operationId: 'getConfirmationStatus', summary: 'Get confirmation status for a match' })
  @ApiParam({ name: 'matchId', type: 'integer' })
  async getConfirmationStatus(@Param('matchId', ParseIntPipe) matchId: number) {
    return this.confirmationService.getStatus(matchId);
  }

  @Post(':matchId/confirmations')
  @ApiOperation({ operationId: 'confirmResult', summary: 'Confirm match result (player vote)' })
  @ApiParam({ name: 'matchId', type: 'integer' })
  async confirmResult(@Req() req: AuthRequest, @Param('matchId', ParseIntPipe) matchId: number) {
    return this.confirmationService.confirm(matchId, req.user.sub);
  }

  @Post(':matchId/confirmations/cancel')
  @ApiOperation({ operationId: 'cancelConfirmation', summary: 'Cancel confirmation phase' })
  @ApiParam({ name: 'matchId', type: 'integer' })
  async cancelConfirmation(@Req() req: AuthRequest, @Param('matchId', ParseIntPipe) matchId: number) {
    return this.confirmationService.cancel(matchId, req.user.sub);
  }
}
