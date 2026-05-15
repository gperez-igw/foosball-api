import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  QUEUE_LEADERBOARD,
  defaultJobOptions,
  type EventEnvelope,
  type LeaderboardInvalidatePayload,
} from '@app/events';

@Injectable()
export class LeaderboardCronService {
  private readonly logger = new Logger(LeaderboardCronService.name);

  constructor(
    @InjectQueue(QUEUE_LEADERBOARD)
    private readonly leaderboardQueue: Queue<EventEnvelope<LeaderboardInvalidatePayload>>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async invalidateLeaderboardCache(): Promise<void> {
    const payload: EventEnvelope<LeaderboardInvalidatePayload> = {
      eventType: 'leaderboard.cache-refresh',
      version: 1,
      occurredAt: new Date().toISOString(),
      payload: {
        reason: 'scheduled-hourly-refresh',
        affectedFilters: ['week', 'month', 'year', 'total'],
      },
    };

    const jobId = `leaderboard-refresh:${new Date().toISOString().slice(0, 13)}`;
    await this.leaderboardQueue.add('leaderboard-invalidate', payload, {
      ...defaultJobOptions,
      jobId,
    });

    this.logger.log(`Queued leaderboard cache refresh (jobId=${jobId})`);
  }
}
