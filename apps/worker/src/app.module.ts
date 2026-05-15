import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_MATCHES, QUEUE_LEADERBOARD, QUEUE_AUDIT, defaultJobOptions } from '@app/events';
import { MatchConfirmedProcessor } from './processors/match-confirmed.processor.js';
import { LeaderboardInvalidateProcessor } from './processors/leaderboard-invalidate.processor.js';
import { AuditLogProcessor } from './processors/audit-log.processor.js';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env['REDIS_HOST'] ?? 'localhost',
        port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
        password: process.env['REDIS_PASSWORD'] || undefined,
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_MATCHES, defaultJobOptions },
      { name: QUEUE_LEADERBOARD, defaultJobOptions },
      { name: QUEUE_AUDIT, defaultJobOptions },
    ),
  ],
  providers: [
    MatchConfirmedProcessor,
    LeaderboardInvalidateProcessor,
    AuditLogProcessor,
  ],
})
export class AppModule {}
