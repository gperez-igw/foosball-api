import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { LeaderboardInvalidateProcessor } from './leaderboard-invalidate.processor';
import type { Job } from 'bullmq';
import type { EventEnvelope, LeaderboardInvalidatePayload } from '@app/events';
import { QUEUE_LEADERBOARD } from '@app/events';
import { WORKER_REDIS } from '../constants';

function makeJob(
  overrides: Partial<EventEnvelope<LeaderboardInvalidatePayload>> = {},
  jobOverrides: Partial<Job> = {},
): Job<EventEnvelope<LeaderboardInvalidatePayload>> {
  return {
    id: 'job-2',
    name: 'leaderboard-invalidate',
    attemptsMade: 1,
    opts: { attempts: 3 },
    data: {
      eventType: 'leaderboard-invalidate',
      version: 1,
      occurredAt: '2026-05-15T12:00:00.000Z',
      payload: {
        reason: 'match.confirmed',
        affectedFilters: ['week', 'month', 'year', 'total'],
      },
      ...overrides,
    },
    ...jobOverrides,
  } as unknown as Job<EventEnvelope<LeaderboardInvalidatePayload>>;
}

describe('LeaderboardInvalidateProcessor', () => {
  let processor: LeaderboardInvalidateProcessor;
  let redisMock: { del: jest.Mock };

  beforeEach(async () => {
    redisMock = { del: jest.fn().mockResolvedValue(8) };

    const module = await Test.createTestingModule({
      providers: [
        LeaderboardInvalidateProcessor,
        {
          provide: getQueueToken(QUEUE_LEADERBOARD),
          useValue: {},
        },
        {
          provide: WORKER_REDIS,
          useValue: redisMock,
        },
      ],
    }).compile();

    processor = module.get(LeaderboardInvalidateProcessor);
  });

  it('processes a valid v1 job and deletes Redis keys', async () => {
    const job = makeJob();
    await expect(processor.process(job)).resolves.toBeUndefined();
    expect(redisMock.del).toHaveBeenCalledWith(
      'leaderboard:users:week',
      'leaderboard:users:month',
      'leaderboard:users:year',
      'leaderboard:users:total',
      'leaderboard:pairs:week',
      'leaderboard:pairs:month',
      'leaderboard:pairs:year',
      'leaderboard:pairs:total',
    );
  });

  it('throws on version mismatch', async () => {
    const job = makeJob({ version: 3 });
    await expect(processor.process(job)).rejects.toThrow(
      'Unsupported event version: 3',
    );
  });

  it('logs DLQ when attempts exhausted', () => {
    const logSpy = jest.spyOn((processor as any).logger, 'error');
    const job = makeJob({}, { attemptsMade: 3, opts: { attempts: 3 } } as Partial<Job>);
    processor.onFailed(job, new Error('test'));
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('exhausted all retries'),
      expect.any(Object),
    );
  });
});
