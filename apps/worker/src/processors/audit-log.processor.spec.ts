import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { AuditLogProcessor } from './audit-log.processor';
import type { Job } from 'bullmq';
import type { EventEnvelope, AuditLogPayload } from '@app/events';
import { QUEUE_AUDIT } from '@app/events';
import { AuditLogEntity } from '@app/matches/entities/audit-log.entity';

const mockPayload: AuditLogPayload = {
  entityType: 'match',
  entityId: 10,
  action: 'result_override',
  actorId: 1,
  beforeData: { scoreA: 5, scoreB: 3 },
  afterData: { scoreA: 6, scoreB: 3 },
  reason: 'Score entry error',
};

function makeJob(
  overrides: Partial<EventEnvelope<AuditLogPayload>> = {},
  jobOverrides: Partial<Job> = {},
): Job<EventEnvelope<AuditLogPayload>> {
  return {
    id: 'job-audit-1',
    name: 'audit-log-write',
    attemptsMade: 1,
    opts: { attempts: 5 },
    data: {
      eventType: 'audit-log-write',
      version: 1,
      occurredAt: '2026-05-15T12:00:00.000Z',
      payload: { ...mockPayload },
      ...overrides,
    },
    ...jobOverrides,
  } as unknown as Job<EventEnvelope<AuditLogPayload>>;
}

describe('AuditLogProcessor', () => {
  let processor: AuditLogProcessor;
  let repositoryMock: {
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    repositoryMock = {
      create: jest.fn().mockImplementation((data) => ({ ...data, id: 99 })),
      save: jest.fn().mockResolvedValue({ id: 99 }),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuditLogProcessor,
        {
          provide: getRepositoryToken(AuditLogEntity),
          useValue: repositoryMock,
        },
        {
          provide: getQueueToken(QUEUE_AUDIT),
          useValue: {},
        },
      ],
    }).compile();

    processor = module.get(AuditLogProcessor);
  });

  describe('process()', () => {
    it('persists audit log to DB on a valid v1 job', async () => {
      const job = makeJob();
      await expect(processor.process(job)).resolves.toBeUndefined();

      expect(repositoryMock.create).toHaveBeenCalledWith({
        entityType: mockPayload.entityType,
        entityId: mockPayload.entityId,
        action: mockPayload.action,
        actorId: mockPayload.actorId,
        beforeData: mockPayload.beforeData,
        afterData: mockPayload.afterData,
        reason: mockPayload.reason,
      });
      expect(repositoryMock.save).toHaveBeenCalledTimes(1);
    });

    it('sets reason to null when payload reason is null', async () => {
      const job = makeJob({
        payload: { ...mockPayload, reason: null },
      });
      await processor.process(job);

      expect(repositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ reason: null }),
      );
    });

    it('throws on version mismatch — moves job to DLQ', async () => {
      const job = makeJob({ version: 2 });
      await expect(processor.process(job)).rejects.toThrow(
        'Unsupported event version: 2',
      );
      expect(repositoryMock.save).not.toHaveBeenCalled();
    });

    it('propagates DB save error so BullMQ can retry', async () => {
      repositoryMock.save.mockRejectedValueOnce(new Error('DB connection lost'));
      const job = makeJob();
      await expect(processor.process(job)).rejects.toThrow('DB connection lost');
    });
  });

  describe('onFailed() — DLQ path', () => {
    it('logs DLQ when all retries are exhausted', () => {
      const logSpy = jest.spyOn((processor as any).logger, 'error');
      const job = makeJob({}, { attemptsMade: 5, opts: { attempts: 5 } } as Partial<Job>);
      processor.onFailed(job, new Error('final error'));

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('exhausted all retries'),
        expect.any(Object),
      );
    });

    it('does not log DLQ message when retries remain', () => {
      const logSpy = jest.spyOn((processor as any).logger, 'error');
      const job = makeJob({}, { attemptsMade: 2, opts: { attempts: 5 } } as Partial<Job>);
      processor.onFailed(job, new Error('transient error'));

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('exhausted all retries'),
        expect.anything(),
      );
    });
  });
});
