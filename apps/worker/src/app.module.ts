import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { QUEUE_MATCHES, QUEUE_LEADERBOARD, QUEUE_AUDIT, defaultJobOptions } from '@app/events';
import { AuditLogEntity } from '@app/matches/entities/audit-log.entity';
import { MatchConfirmedProcessor } from './processors/match-confirmed.processor.js';
import { LeaderboardInvalidateProcessor } from './processors/leaderboard-invalidate.processor.js';
import { AuditLogProcessor } from './processors/audit-log.processor.js';
import { WORKER_REDIS } from './constants.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.getOrThrow<string>('DB_USER'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        database: config.getOrThrow<string>('DB_NAME'),
        entities: [AuditLogEntity],
        synchronize: false,
        migrationsRun: false,
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
    TypeOrmModule.forFeature([AuditLogEntity]),
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
  providers: [
    {
      provide: WORKER_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        return new Redis({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          lazyConnect: true,
        });
      },
    },
    MatchConfirmedProcessor,
    LeaderboardInvalidateProcessor,
    AuditLogProcessor,
  ],
})
export class AppModule {}
