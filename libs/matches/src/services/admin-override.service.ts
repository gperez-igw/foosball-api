import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { MatchRepository } from '../repositories/match.repository.js';
import { MatchEntity } from '../entities/match.entity.js';
import { AuditLogEntity } from '../entities/audit-log.entity.js';
import { AdminOverrideResultDto } from '../dto/admin-override.dto.js';
import {
  QUEUE_AUDIT,
  QUEUE_LEADERBOARD,
  defaultJobOptions,
} from '@app/events';
import type {
  EventEnvelope,
  AuditLogPayload,
  LeaderboardInvalidatePayload,
} from '@app/events';

export interface AdminOverrideResult {
  match: MatchEntity;
  auditLog: AuditLogEntity;
}

@Injectable()
export class AdminOverrideService {
  constructor(
    private readonly matchRepository: MatchRepository,
    @InjectQueue(QUEUE_AUDIT) private readonly auditQueue: Queue,
    @InjectQueue(QUEUE_LEADERBOARD) private readonly leaderboardQueue: Queue,
  ) {}

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

      // Save audit log inside the same transaction so it rolls back with the match update
      const auditLogData = new AuditLogEntity();
      auditLogData.actorId = actorId;
      auditLogData.action = 'result_override';
      auditLogData.entityType = 'match';
      auditLogData.entityId = matchId;
      auditLogData.beforeData = beforeData as Record<string, unknown>;
      auditLogData.afterData = afterData as Record<string, unknown>;
      auditLogData.reason = dto.reason ?? null;
      const auditLog = await queryRunner.manager.save(AuditLogEntity, auditLogData);

      // Publish audit-log-write event — if this fails the whole transaction rolls back
      const auditEvent: EventEnvelope<AuditLogPayload> = {
        eventType: 'audit-log-write',
        version: 1,
        occurredAt: new Date().toISOString(),
        payload: {
          entityType: 'match',
          entityId: matchId,
          action: 'result_override',
          actorId,
          beforeData: beforeData as Record<string, unknown>,
          afterData: afterData as Record<string, unknown>,
          reason: dto.reason ?? null,
        },
      };
      await this.auditQueue.add('audit-log-write', auditEvent, defaultJobOptions);

      // Publish leaderboard-invalidate event (also part of the operation; rollback if fails)
      const invalidateEvent: EventEnvelope<LeaderboardInvalidatePayload> = {
        eventType: 'leaderboard-invalidate',
        version: 1,
        occurredAt: new Date().toISOString(),
        payload: {
          reason: 'admin.result_override',
          affectedFilters: ['week', 'month', 'year', 'total'],
        },
      };
      await this.leaderboardQueue.add('leaderboard-invalidate', invalidateEvent, defaultJobOptions);

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
