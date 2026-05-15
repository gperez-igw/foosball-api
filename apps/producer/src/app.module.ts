import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_MATCHES, QUEUE_LEADERBOARD, QUEUE_AUDIT, defaultJobOptions } from '@app/events';
import { LeaderboardCronService } from './schedulers/leaderboard-cron.service.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
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
  providers: [LeaderboardCronService],
})
export class AppModule {}
