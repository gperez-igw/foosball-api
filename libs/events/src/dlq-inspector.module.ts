import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_MATCHES, QUEUE_LEADERBOARD, QUEUE_AUDIT } from './queue-names.js';
import { defaultJobOptions } from './queue-config.js';
import { DlqInspectorService } from './dlq-inspector.service.js';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_MATCHES, defaultJobOptions },
      { name: QUEUE_LEADERBOARD, defaultJobOptions },
      { name: QUEUE_AUDIT, defaultJobOptions },
    ),
  ],
  providers: [DlqInspectorService],
  exports: [DlqInspectorService],
})
export class DlqInspectorModule {}
