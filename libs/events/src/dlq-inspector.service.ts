import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_MATCHES, QUEUE_LEADERBOARD, QUEUE_AUDIT } from './queue-names.js';

export interface DlqJob {
  id: string;
  name: string;
  queue: string;
  failedReason: string;
  attemptsMade: number;
  timestamp: number;
  data: unknown;
}

@Injectable()
export class DlqInspectorService implements OnModuleInit {
  private readonly logger = new Logger(DlqInspectorService.name);
  private readonly queues: Map<string, Queue> = new Map();

  constructor(
    @InjectQueue(QUEUE_MATCHES) private readonly matchesQueue: Queue,
    @InjectQueue(QUEUE_LEADERBOARD) private readonly leaderboardQueue: Queue,
    @InjectQueue(QUEUE_AUDIT) private readonly auditQueue: Queue,
  ) {}

  onModuleInit(): void {
    this.queues.set(QUEUE_MATCHES, this.matchesQueue);
    this.queues.set(QUEUE_LEADERBOARD, this.leaderboardQueue);
    this.queues.set(QUEUE_AUDIT, this.auditQueue);
  }

  /**
   * Returns all failed (DLQ) jobs across all queues, or for a specific queue
   * if queueName is provided.
   */
  async listFailed(queueName?: string): Promise<DlqJob[]> {
    if (queueName) {
      const queue = this.queues.get(queueName);
      if (!queue) {
        this.logger.warn(`DlqInspectorService: unknown queue "${queueName}"`);
        return [];
      }
      return this.getFailedFromQueue(queue, queueName);
    }

    const results: DlqJob[] = [];
    for (const [name, queue] of this.queues.entries()) {
      const jobs = await this.getFailedFromQueue(queue, name);
      results.push(...jobs);
    }
    return results;
  }

  /**
   * Retries a specific failed job by id in the given queue.
   */
  async retryJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Unknown queue: ${queueName}`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found in queue ${queueName}`);
    }

    await job.retry('failed');
    this.logger.log(`Retried job ${jobId} in queue ${queueName}`);
  }

  private async getFailedFromQueue(queue: Queue, queueName: string): Promise<DlqJob[]> {
    const failedJobs = await queue.getFailed();
    return failedJobs.map((job) => ({
      id: String(job.id),
      name: job.name,
      queue: queueName,
      failedReason: job.failedReason ?? 'unknown',
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      data: job.data,
    }));
  }
}
