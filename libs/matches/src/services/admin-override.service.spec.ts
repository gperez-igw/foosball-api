import { Test } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { AdminOverrideService } from './admin-override.service';
import { MatchRepository } from '../repositories/match.repository';
import { QUEUE_AUDIT, QUEUE_LEADERBOARD } from '@app/events';
import type { MatchEntity } from '../entities/match.entity';
import type { AuditLogEntity } from '../entities/audit-log.entity';

const mockMatchRepository = () => ({
  findById: jest.fn(),
  save: jest.fn(),
  saveAuditLog: jest.fn(),
  findPlayers: jest.fn(),
  delete: jest.fn(),
  findAuditLogs: jest.fn(),
  getDataSource: jest.fn(),
});

const mockQueue = () => ({
  add: jest.fn().mockResolvedValue(undefined),
});

function makeMatch(overrides: Partial<MatchEntity> = {}): MatchEntity {
  return {
    id: 42,
    createdBy: 10,
    matchType: '2v2',
    status: 'confirmed',
    scoreA: 5,
    scoreB: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    confirmedAt: new Date(),
    lockedAt: new Date(),
    players: [],
    confirmations: [],
    ...overrides,
  } as unknown as MatchEntity;
}

function makeAuditLog(overrides: Partial<AuditLogEntity> = {}): AuditLogEntity {
  return {
    id: 1,
    actorId: 2,
    action: 'result_override',
    entityType: 'match',
    entityId: 42,
    beforeData: { scoreA: 5, scoreB: 3 },
    afterData: { scoreA: 6, scoreB: 3 },
    reason: null,
    createdAt: new Date(),
    ...overrides,
  } as unknown as AuditLogEntity;
}

function makeQueryRunner(failOn?: 'save' | 'auditLog' | 'queue') {
  const manager = {
    save: jest.fn().mockImplementation(async (entity: any) => {
      if (failOn === 'save') throw new Error('DB save error');
      return entity;
    }),
  };
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager,
  };
}

describe('AdminOverrideService', () => {
  let service: AdminOverrideService;
  let repo: ReturnType<typeof mockMatchRepository>;
  let auditQueue: ReturnType<typeof mockQueue>;
  let leaderboardQueue: ReturnType<typeof mockQueue>;

  beforeEach(async () => {
    repo = mockMatchRepository();
    auditQueue = mockQueue();
    leaderboardQueue = mockQueue();

    const module = await Test.createTestingModule({
      providers: [
        AdminOverrideService,
        { provide: MatchRepository, useValue: repo },
        { provide: getQueueToken(QUEUE_AUDIT), useValue: auditQueue },
        { provide: getQueueToken(QUEUE_LEADERBOARD), useValue: leaderboardQueue },
      ],
    }).compile();

    service = module.get(AdminOverrideService);
  });

  describe('overrideResult', () => {
    it('overrides score, writes audit log, publishes events', async () => {
      const match = makeMatch();
      const auditLog = makeAuditLog({ afterData: { scoreA: 6, scoreB: 3 } });
      const qr = makeQueryRunner();

      repo.findById.mockResolvedValue(match);
      repo.saveAuditLog.mockResolvedValue(auditLog);
      repo.findPlayers.mockResolvedValue([]);
      repo.getDataSource.mockReturnValue({ createQueryRunner: () => qr });

      const result = await service.overrideResult(42, 2, true, { scoreA: 6, scoreB: 3 });

      expect(result.match.scoreA).toBe(6);
      expect(result.auditLog).toBe(auditLog);
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(auditQueue.add).toHaveBeenCalledWith(
        'audit-log-write',
        expect.objectContaining({ eventType: 'audit-log-write', version: 1 }),
        expect.anything(),
      );
      expect(leaderboardQueue.add).toHaveBeenCalledWith(
        'leaderboard-invalidate',
        expect.objectContaining({ eventType: 'leaderboard-invalidate', version: 1 }),
        expect.anything(),
      );
    });

    it('throws ForbiddenException when is_admin=false', async () => {
      await expect(
        service.overrideResult(42, 2, false, { scoreA: 6, scoreB: 3 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when match not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.overrideResult(99, 2, true, { scoreA: 6, scoreB: 3 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException (MATCH_NOT_CONFIRMED) for non-confirmed match', async () => {
      const match = makeMatch({ status: 'awaiting_confirmation' });
      repo.findById.mockResolvedValue(match);

      await expect(
        service.overrideResult(42, 2, true, { scoreA: 6, scoreB: 3 }),
      ).rejects.toThrow(ConflictException);
    });

    it('rolls back DB and throws InternalServerErrorException when queue publish fails', async () => {
      const match = makeMatch();
      const qr = makeQueryRunner();

      repo.findById.mockResolvedValue(match);
      repo.saveAuditLog.mockResolvedValue(makeAuditLog());
      repo.getDataSource.mockReturnValue({ createQueryRunner: () => qr });
      // Make audit queue throw
      auditQueue.add.mockRejectedValue(new Error('Redis unavailable'));

      await expect(
        service.overrideResult(42, 2, true, { scoreA: 6, scoreB: 3 }),
      ).rejects.toThrow(InternalServerErrorException);

      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('deleteMatch', () => {
    it('deletes a non-confirmed match without audit log', async () => {
      const match = makeMatch({ status: 'playing' });
      repo.findById.mockResolvedValue(match);
      repo.delete.mockResolvedValue(undefined);

      await service.deleteMatch(42, 2, true);
      expect(repo.saveAuditLog).not.toHaveBeenCalled();
      expect(repo.delete).toHaveBeenCalledWith(42);
    });

    it('writes audit log before deleting a confirmed match', async () => {
      const match = makeMatch({ status: 'confirmed' });
      repo.findById.mockResolvedValue(match);
      repo.saveAuditLog.mockResolvedValue(makeAuditLog());
      repo.delete.mockResolvedValue(undefined);

      await service.deleteMatch(42, 2, true);
      expect(repo.saveAuditLog).toHaveBeenCalled();
      expect(repo.delete).toHaveBeenCalledWith(42);
    });

    it('throws ForbiddenException when not admin', async () => {
      await expect(service.deleteMatch(42, 2, false)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when match not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.deleteMatch(99, 2, true)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAuditLog', () => {
    it('returns audit entries for the match', async () => {
      const match = makeMatch();
      const logs = [makeAuditLog()];
      repo.findById.mockResolvedValue(match);
      repo.findAuditLogs.mockResolvedValue(logs);

      const result = await service.getAuditLog(42, true);
      expect(result).toBe(logs);
    });

    it('throws ForbiddenException when not admin', async () => {
      await expect(service.getAuditLog(42, false)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when match not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.getAuditLog(99, true)).rejects.toThrow(NotFoundException);
    });
  });
});
