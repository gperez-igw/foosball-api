import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { MatchConfirmedProcessor } from './match-confirmed.processor';
import type { Job } from 'bullmq';
import type { EventEnvelope, MatchConfirmedPayload } from '@app/events';
import { QUEUE_MATCHES } from '@app/events';

function makeJob(
  overrides: Partial<EventEnvelope<MatchConfirmedPayload>> = {},
  jobOverrides: Partial<Job> = {},
): Job<EventEnvelope<MatchConfirmedPayload>> {
  return {
    id: 'job-1',
    name: 'match.confirmed',
    attemptsMade: 1,
    opts: { attempts: 5 },
    data: {
      eventType: 'match.confirmed',
      version: 1,
      occurredAt: '2026-05-15T12:00:00.000Z',
      payload: {
        matchId: 42,
        winnerTeam: 'A',
        scoreA: 5,
        scoreB: 3,
        confirmedAt: '2026-05-15T12:00:00.000Z',
      },
      ...overrides,
    },
    ...jobOverrides,
  } as unknown as Job<EventEnvelope<MatchConfirmedPayload>>;
}

describe('MatchConfirmedProcessor', () => {
  let processor: MatchConfirmedProcessor;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MatchConfirmedProcessor,
        {
          provide: getQueueToken(QUEUE_MATCHES),
          useValue: {},
        },
      ],
    }).compile();

    processor = module.get(MatchConfirmedProcessor);
  });

  it('processes a valid v1 job without throwing', async () => {
    const job = makeJob();
    await expect(processor.process(job)).resolves.toBeUndefined();
  });

  it('throws on version mismatch — moves to DLQ', async () => {
    const job = makeJob({ version: 2 });
    await expect(processor.process(job)).rejects.toThrow(
      'Unsupported event version: 2',
    );
  });

  it('logs DLQ when attempts exhausted', () => {
    const logSpy = jest.spyOn((processor as any).logger, 'error');
    const job = makeJob({}, { attemptsMade: 5, opts: { attempts: 5 } } as Partial<Job>);
    processor.onFailed(job, new Error('test error'));
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('exhausted all retries'),
      expect.any(Object),
    );
  });

  it('does not log DLQ when there are remaining attempts', () => {
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
