import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Job } from 'bullmq';
import { QUEUE_AUDIT } from '@app/events';
import type { EventEnvelope, AuditLogPayload } from '@app/events';
import { AuditLogEntity } from '@app/matches/entities/audit-log.entity.js';

@Injectable()
@Processor(QUEUE_AUDIT)
export class AuditLogProcessor extends WorkerHost {
  private readonly logger = new Logger(AuditLogProcessor.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepository: Repository<AuditLogEntity>,
  ) {
    super();
  }

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
    );

    const entry = this.auditLogRepository.create({
      entityType,
      entityId,
      action,
      actorId,
      beforeData,
      afterData,
      reason: reason ?? null,
    });

    await this.auditLogRepository.save(entry);

    this.logger.log(`Audit log persisted: id=${entry.id} action=${action}`);
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
