import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_MATCHES, QUEUE_LEADERBOARD, QUEUE_AUDIT, defaultJobOptions } from '@app/events';
import { LeaderboardCronService } from './schedulers/leaderboard-cron.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
        },
      }),
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
