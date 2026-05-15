import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { LeaderboardCronService } from './leaderboard-cron.service';
import { QUEUE_LEADERBOARD } from '@app/events';

describe('LeaderboardCronService', () => {
  let service: LeaderboardCronService;
  let mockQueue: { add: jest.Mock };

  beforeEach(async () => {
    mockQueue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };

    const module = await Test.createTestingModule({
      providers: [
        LeaderboardCronService,
        {
          provide: getQueueToken(QUEUE_LEADERBOARD),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get(LeaderboardCronService);
  });

  it('publishes a leaderboard-invalidate event with all filters', async () => {
    await service.invalidateLeaderboardCache();

    expect(mockQueue.add).toHaveBeenCalledTimes(1);

    const [jobName, payload, opts] = mockQueue.add.mock.calls[0] as [string, unknown, unknown];
    expect(jobName).toBe('leaderboard-invalidate');

    const envelope = payload as {
      eventType: string;
      version: number;
      payload: { affectedFilters: string[]; reason: string };
    };
    expect(envelope.version).toBe(1);
    expect(envelope.eventType).toBe('leaderboard.cache-refresh');
    expect(envelope.payload.affectedFilters).toEqual(['week', 'month', 'year', 'total']);
    expect(envelope.payload.reason).toBe('scheduled-hourly-refresh');

    expect((opts as { jobId?: string }).jobId).toBeDefined();
  });

  it('uses a stable jobId per hour for dedup', async () => {
    await service.invalidateLeaderboardCache();
    await service.invalidateLeaderboardCache();

    const [, , opts1] = mockQueue.add.mock.calls[0] as [string, unknown, { jobId: string }];
    const [, , opts2] = mockQueue.add.mock.calls[1] as [string, unknown, { jobId: string }];
    expect(opts1.jobId).toBe(opts2.jobId);
  });
});
