import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { MatchRepository } from '../repositories/match.repository.js';
import { MatchEntity } from '../entities/match.entity.js';
import { AuditLogEntity } from '../entities/audit-log.entity.js';
import { AdminOverrideResultDto } from '../dto/admin-override.dto.js';

export interface AdminOverrideResult {
  match: MatchEntity;
  auditLog: AuditLogEntity;
}

@Injectable()
export class AdminOverrideService {
  constructor(private readonly matchRepository: MatchRepository) {}

  async overrideResult(
    matchId: number,
    actorId: number,
    isAdmin: boolean,
    dto: AdminOverrideResultDto,
  ): Promise<AdminOverrideResult> {
    if (!isAdmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN_ADMIN_REQUIRED', message: 'This action requires admin privileges' });
    }

    const match = await this.matchRepository.findById(matchId);
    if (!match) {
      throw new NotFoundException({ code: 'MATCH_NOT_FOUND', message: `Match ${matchId} does not exist` });
    }

    if (match.status !== 'confirmed') {
      throw new ConflictException({
        code: 'MATCH_NOT_CONFIRMED',
        message: 'Admin result override only applies to confirmed matches',
        details: { status: match.status },
      });
    }

    const beforeData = { scoreA: match.scoreA, scoreB: match.scoreB };
    const afterData = { scoreA: dto.scoreA, scoreB: dto.scoreB };

    const ds = this.matchRepository.getDataSource();
    const queryRunner = ds.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      match.scoreA = dto.scoreA;
      match.scoreB = dto.scoreB;
      await queryRunner.manager.save(match);

      const auditLog = await this.matchRepository.saveAuditLog({
        actorId,
        action: 'result_override',
        entityType: 'match',
        entityId: matchId,
        beforeData,
        afterData,
        reason: dto.reason ?? null,
      });

      await queryRunner.commitTransaction();

      match.players = await this.matchRepository.findPlayers(matchId);

      return { match, auditLog };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException({
        code: 'AUDIT_LOG_WRITE_FAILED',
        message: 'Audit log could not be written; operation rolled back',
      });
    } finally {
      await queryRunner.release();
    }
  }

  async deleteMatch(matchId: number, actorId: number, isAdmin: boolean): Promise<void> {
    if (!isAdmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN_ADMIN_REQUIRED', message: 'This action requires admin privileges' });
    }

    const match = await this.matchRepository.findById(matchId);
    if (!match) {
      throw new NotFoundException({ code: 'MATCH_NOT_FOUND', message: `Match ${matchId} does not exist` });
    }

    if (match.status === 'confirmed') {
      await this.matchRepository.saveAuditLog({
        actorId,
        action: 'match_delete',
        entityType: 'match',
        entityId: matchId,
        beforeData: { scoreA: match.scoreA, scoreB: match.scoreB, status: match.status },
        afterData: {},
        reason: 'Admin deleted confirmed match',
      });
    }

    await this.matchRepository.delete(matchId);
  }

  async getAuditLog(matchId: number, isAdmin: boolean): Promise<AuditLogEntity[]> {
    if (!isAdmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN_ADMIN_REQUIRED', message: 'This action requires admin privileges' });
    }

    const match = await this.matchRepository.findById(matchId);
    if (!match) {
      throw new NotFoundException({ code: 'MATCH_NOT_FOUND', message: `Match ${matchId} does not exist` });
    }

    return this.matchRepository.findAuditLogs('match', matchId);
  }
}
