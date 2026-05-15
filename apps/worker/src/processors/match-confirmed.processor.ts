import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUE_MATCHES } from '@app/events';
import type { EventEnvelope, MatchConfirmedPayload } from '@app/events';

@Processor(QUEUE_MATCHES)
export class MatchConfirmedProcessor extends WorkerHost {
  private readonly logger = new Logger(MatchConfirmedProcessor.name);

  async process(job: Job<EventEnvelope<MatchConfirmedPayload>>): Promise<void> {
    if (job.data.version !== 1) {
      this.logger.warn(
        `[${job.name}] Unsupported version ${job.data.version} — moving to DLQ`,
      );
      throw new Error(`Unsupported event version: ${job.data.version}`);
    }

    const { matchId, winnerTeam, confirmedAt } = job.data.payload;
    this.logger.log(
      `Processing match.confirmed: matchId=${matchId} winner=${winnerTeam} at=${confirmedAt}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EventEnvelope<MatchConfirmedPayload>>, error: Error): void {
    const isDlq =
      job.attemptsMade >= (job.opts.attempts ?? 1);
    this.logger.error(
      `Job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts ?? 1}): ${error.message}`,
    );
    if (isDlq) {
      this.logger.error(
        `Job ${job.id} exhausted all retries — landed in DLQ`,
        { jobId: job.id, jobName: job.name, data: job.data },
      );
    }
  }
}
