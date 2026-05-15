import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUE_AUDIT } from '@app/events';
import type { EventEnvelope, AuditLogPayload } from '@app/events';

@Processor(QUEUE_AUDIT)
export class AuditLogProcessor extends WorkerHost {
  private readonly logger = new Logger(AuditLogProcessor.name);

  async process(job: Job<EventEnvelope<AuditLogPayload>>): Promise<void> {
    if (job.data.version !== 1) {
      this.logger.warn(
        `[${job.name}] Unsupported version ${job.data.version} — moving to DLQ`,
      );
      throw new Error(`Unsupported event version: ${job.data.version}`);
    }

    const { entityType, entityId, action, actorId, beforeData, afterData, reason } =
      job.data.payload;

    this.logger.log(
      `Processing audit-log-write: action=${action} entity=${entityType}:${entityId} actor=${actorId}`,
      { beforeData, afterData, reason },
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EventEnvelope<AuditLogPayload>>, error: Error): void {
    const isDlq = job.attemptsMade >= (job.opts.attempts ?? 1);
    this.logger.error(
      `Job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts ?? 1}): ${error.message}`,
    );
    if (isDlq) {
      this.logger.error(`Job ${job.id} exhausted all retries — landed in DLQ`, {
        jobId: job.id,
        jobName: job.name,
        data: job.data,
      });
    }
  }
}
