import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { MatchRepository } from '../repositories/match.repository.js';
import { MatchEntity, MatchType } from '../entities/match.entity.js';
import { MatchPlayerEntity } from '../entities/match-player.entity.js';
import { CreateMatchDto } from '../dto/create-match.dto.js';
import { UpdateMatchDto } from '../dto/update-match.dto.js';
import { AddPlayersDto } from '../dto/add-players.dto.js';
import { SubmitResultDto } from '../dto/submit-result.dto.js';
import { ListMatchesDto } from '../dto/list-matches.dto.js';

const MATCH_CAPACITY: Record<MatchType, number> = {
  '1v1': 2,
  '2v2': 4,
  '4v4': 8,
};

@Injectable()
export class MatchService {
  constructor(private readonly matchRepository: MatchRepository) {}

  async create(userId: number, dto: CreateMatchDto): Promise<MatchEntity> {
    const match = await this.matchRepository.create({
      createdBy: userId,
      matchType: dto.matchType ?? '2v2',
      status: 'draft',
    });
    match.players = [];
    return match;
  }

  async list(dto: ListMatchesDto) {
    return this.matchRepository.findPaginated({
      status: dto.status,
      matchType: dto.matchType,
      createdBy: dto.createdBy,
      cursor: dto.cursor,
      limit: dto.limit ?? 20,
    });
  }

  async findById(matchId: number): Promise<MatchEntity> {
    const match = await this.matchRepository.findById(matchId);
    if (!match) {
      throw new NotFoundException({ code: 'MATCH_NOT_FOUND', message: `Match ${matchId} does not exist` });
    }
    if (!match.players) {
      match.players = await this.matchRepository.findPlayers(matchId);
    }
    return match;
  }

  async update(matchId: number, userId: number, dto: UpdateMatchDto): Promise<MatchEntity> {
    const match = await this.findById(matchId);

    if (match.createdBy !== userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN_NOT_CREATOR', message: 'Only the match creator can update this match' });
    }

    if (match.status === 'awaiting_confirmation' || match.status === 'confirmed') {
      throw new ConflictException({
        code: 'MATCH_LOCKED',
        message: 'Cannot modify a match in awaiting_confirmation or confirmed status',
        details: { matchId, status: match.status },
      });
    }

    if (dto.scoreA !== undefined) match.scoreA = dto.scoreA;
    if (dto.scoreB !== undefined) match.scoreB = dto.scoreB;

    const saved = await this.matchRepository.save(match);
    saved.players = await this.matchRepository.findPlayers(matchId);
    return saved;
  }

  async delete(matchId: number, userId: number, isAdmin: boolean): Promise<void> {
    if (!isAdmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN_ADMIN_REQUIRED', message: 'This action requires admin privileges' });
    }
    const match = await this.matchRepository.findById(matchId);
    if (!match) {
      throw new NotFoundException({ code: 'MATCH_NOT_FOUND', message: `Match ${matchId} does not exist` });
    }
    await this.matchRepository.delete(matchId);
  }

  async addPlayers(matchId: number, userId: number, dto: AddPlayersDto): Promise<MatchEntity> {
    const match = await this.findById(matchId);

    if (match.createdBy !== userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN_NOT_CREATOR', message: 'Only the match creator can add players' });
    }

    if (match.status === 'awaiting_confirmation' || match.status === 'confirmed') {
      throw new ConflictException({
        code: 'MATCH_LOCKED',
        message: 'Cannot modify a match in awaiting_confirmation or confirmed status',
        details: { matchId, status: match.status },
      });
    }

    const existingPlayers = await this.matchRepository.findPlayers(matchId);
    const capacity = MATCH_CAPACITY[match.matchType];

    if (existingPlayers.length + dto.players.length > capacity) {
      throw new BadRequestException({
        code: 'CAPACITY_EXCEEDED',
        message: `${match.matchType} match supports ${capacity} players; currently ${existingPlayers.length}`,
        details: { capacity, current: existingPlayers.length },
      });
    }

    for (const p of dto.players) {
      const slotTaken = existingPlayers.some((ep) => ep.team === p.team && ep.slot === p.slot);
      if (slotTaken) {
        throw new BadRequestException({
          code: 'SLOT_CONFLICT',
          message: `Team ${p.team} slot ${p.slot} is already occupied`,
          details: { matchId, team: p.team, slot: p.slot },
        });
      }
    }

    await this.matchRepository.savePlayers(
      dto.players.map((p) => ({
        matchId,
        userId: p.userId,
        team: p.team,
        slot: p.slot,
        position: p.position ?? null,
      })),
    );

    const allPlayers = await this.matchRepository.findPlayers(matchId);
    if (match.status === 'draft' && allPlayers.length > 0) {
      match.status = 'playing';
      await this.matchRepository.save(match);
    }

    match.players = allPlayers;
    return match;
  }

  async submitResult(matchId: number, userId: number, dto: SubmitResultDto): Promise<MatchEntity> {
    const match = await this.findById(matchId);

    if (match.createdBy !== userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN_NOT_CREATOR', message: 'Only the match creator can submit the result' });
    }

    if (match.status === 'awaiting_confirmation' || match.status === 'confirmed') {
      throw new ConflictException({
        code: 'MATCH_LOCKED',
        message: 'Match is already in confirmation or confirmed',
        details: { matchId, status: match.status },
      });
    }

    const players = await this.matchRepository.findPlayers(matchId);
    const capacity = MATCH_CAPACITY[match.matchType];

    if (players.length < capacity) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_PLAYERS',
        message: `${match.matchType} match requires ${capacity} players (${capacity / 2} per team); only ${players.length} registered`,
        details: { required: capacity, registered: players.length },
      });
    }

    match.scoreA = dto.scoreA;
    match.scoreB = dto.scoreB;
    match.status = 'awaiting_confirmation';

    const saved = await this.matchRepository.save(match);
    saved.players = players;
    return saved;
  }
}
