import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { LeaderboardRepository } from './leaderboard.repository.js';
import { LeaderboardService, LEADERBOARD_REDIS } from './leaderboard.service.js';

@Module({
  providers: [
    LeaderboardRepository,
    {
      provide: LEADERBOARD_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return new Redis({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
        });
      },
    },
    LeaderboardService,
  ],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
