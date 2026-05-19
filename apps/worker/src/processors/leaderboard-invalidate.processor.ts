import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, Inject } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { QUEUE_LEADERBOARD } from '@app/events';
import type { EventEnvelope, LeaderboardInvalidatePayload } from '@app/events';
import { WORKER_REDIS } from '../constants.js';

const CACHE_KEY_PREFIX = process.env['QUEUE_PREFIX'] ?? 'leaderboard';

@Processor(QUEUE_LEADERBOARD)
export class LeaderboardInvalidateProcessor extends WorkerHost {
  private readonly logger = new Logger(LeaderboardInvalidateProcessor.name);

  constructor(@Inject(WORKER_REDIS) private readonly redis: Redis) {
    super();
  }

  async process(
    job: Job<EventEnvelope<LeaderboardInvalidatePayload>>,
  ): Promise<void> {
    if (job.data.version !== 1) {
      this.logger.warn(
        `[${job.name}] Unsupported version ${job.data.version} — moving to DLQ`,
      );
      throw new Error(`Unsupported event version: ${job.data.version}`);
    }

    const { affectedFilters, reason } = job.data.payload;
    this.logger.log(
      `Invalidating leaderboard cache: filters=${affectedFilters.join(',')} reason=${reason}`,
    );

    const scopes = ['users', 'pairs'];
    const keysToDelete: string[] = [];

    for (const scope of scopes) {
      for (const filter of affectedFilters) {
        keysToDelete.push(`${CACHE_KEY_PREFIX}:${scope}:${filter}`);
      }
    }

    if (keysToDelete.length > 0) {
      await this.redis.del(...keysToDelete);
      this.logger.log(`Deleted cache keys: ${keysToDelete.join(', ')}`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(
    job: Job<EventEnvelope<LeaderboardInvalidatePayload>>,
    error: Error,
  ): void {
    const isDlq = job.attemptsMade >= (job.opts.attempts ?? 1);
    this.logger.error(
      `Job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts ?? 1}): ${error.message}`,
    );
    if (isDlq) {
      this.logger.error(`Job ${job.id} exhausted all retries — landed in DLQ`, {
        jobId: job.id,
        jobName: job.name,
      });
    }
  }
}
