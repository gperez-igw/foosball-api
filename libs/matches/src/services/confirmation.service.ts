import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { MatchRepository } from '../repositories/match.repository.js';
import { MatchConfirmationEntity } from '../entities/match-confirmation.entity.js';

export interface ConfirmationStatusResult {
  matchId: number;
  totalPlayers: number;
  confirmedCount: number;
  quorumRequired: number;
  quorumReached: boolean;
  confirmations: Array<{ userId: number; confirmedAt: Date }>;
}

@Injectable()
export class ConfirmationService {
  constructor(private readonly matchRepository: MatchRepository) {}

  calculateQuorum(totalPlayers: number): number {
    return Math.floor(totalPlayers / 2) + 1;
  }

  async getStatus(matchId: number): Promise<ConfirmationStatusResult> {
    const match = await this.matchRepository.findById(matchId);
    if (!match) {
      throw new NotFoundException({ code: 'MATCH_NOT_FOUND', message: `Match ${matchId} does not exist` });
    }

    if (match.status !== 'awaiting_confirmation') {
      throw new ConflictException({
        code: 'MATCH_NOT_AWAITING_CONFIRMATION',
        message: 'Match is not in awaiting_confirmation status',
        details: { status: match.status },
      });
    }

    const players = await this.matchRepository.findPlayers(matchId);
    const confirmations = await this.matchRepository.findConfirmations(matchId);
    const totalPlayers = players.length;
    const confirmedCount = confirmations.length;
    const quorumRequired = this.calculateQuorum(totalPlayers);
    const quorumReached = confirmedCount >= quorumRequired;

    return {
      matchId,
      totalPlayers,
      confirmedCount,
      quorumRequired,
      quorumReached,
      confirmations: confirmations.map((c) => ({ userId: c.userId, confirmedAt: c.confirmedAt })),
    };
  }

  async confirm(matchId: number, userId: number): Promise<ConfirmationStatusResult> {
    const match = await this.matchRepository.findById(matchId);
    if (!match) {
      throw new NotFoundException({ code: 'MATCH_NOT_FOUND', message: `Match ${matchId} does not exist` });
    }

    if (match.status !== 'awaiting_confirmation') {
      throw new ConflictException({
        code: 'MATCH_NOT_AWAITING_CONFIRMATION',
        message: 'Match is not in awaiting_confirmation status',
        details: { status: match.status },
      });
    }

    const players = await this.matchRepository.findPlayers(matchId);
    const isPlayer = players.some((p) => p.userId === userId);
    if (!isPlayer) {
      throw new ForbiddenException({
        code: 'NOT_A_PLAYER',
        message: 'You are not registered as a player in this match',
      });
    }

    const existing = await this.matchRepository.findConfirmation(matchId, userId);
    if (!existing) {
      await this.matchRepository.saveConfirmation(matchId, userId);
    }

    const confirmations = await this.matchRepository.findConfirmations(matchId);
    const totalPlayers = players.length;
    const confirmedCount = confirmations.length;
    const quorumRequired = this.calculateQuorum(totalPlayers);
    const quorumReached = confirmedCount >= quorumRequired;

    if (quorumReached && match.status === 'awaiting_confirmation') {
      match.status = 'confirmed';
      match.confirmedAt = new Date();
      match.lockedAt = match.confirmedAt;
      await this.matchRepository.save(match);
    }

    return {
      matchId,
      totalPlayers,
      confirmedCount,
      quorumRequired,
      quorumReached,
      confirmations: confirmations.map((c) => ({ userId: c.userId, confirmedAt: c.confirmedAt })),
    };
  }

  async cancel(matchId: number, userId: number): Promise<ConfirmationStatusResult> {
    const match = await this.matchRepository.findById(matchId);
    if (!match) {
      throw new NotFoundException({ code: 'MATCH_NOT_FOUND', message: `Match ${matchId} does not exist` });
    }

    if (match.status === 'confirmed') {
      throw new ConflictException({
        code: 'MATCH_ALREADY_CONFIRMED',
        message: 'A confirmed match result cannot be cancelled',
        details: { matchId, status: match.status },
      });
    }

    if (match.status !== 'awaiting_confirmation') {
      throw new ConflictException({
        code: 'MATCH_NOT_AWAITING_CONFIRMATION',
        message: 'Match is not in awaiting_confirmation status',
        details: { status: match.status },
      });
    }

    if (match.createdBy !== userId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_NOT_CREATOR',
        message: 'Only the match creator can cancel the confirmation phase',
      });
    }

    await this.matchRepository.deleteAllConfirmations(matchId);
    match.status = 'playing';
    await this.matchRepository.save(match);

    const players = await this.matchRepository.findPlayers(matchId);
    const quorumRequired = this.calculateQuorum(players.length);

    return {
      matchId,
      totalPlayers: players.length,
      confirmedCount: 0,
      quorumRequired,
      quorumReached: false,
      confirmations: [],
    };
  }
}
