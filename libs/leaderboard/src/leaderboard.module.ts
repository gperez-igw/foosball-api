import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { LeaderboardRepository } from './leaderboard.repository.js';
import { LeaderboardService, LEADERBOARD_REDIS } from './leaderboard.service.js';

@Module({
  providers: [
    LeaderboardRepository,
    {
      provide: LEADERBOARD_REDIS,
      useFactory: () => {
        return new Redis({
          host: process.env.REDIS_HOST ?? 'localhost',
          port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
          db: 1,
        });
      },
    },
    LeaderboardService,
  ],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
