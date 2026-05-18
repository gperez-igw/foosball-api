import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { MatchesModule } from '@app/matches';
import { LeaderboardModule } from '@app/leaderboard';
import { AuthModule, JwtAuthGuard } from '@app/auth';
import { DlqInspectorModule } from '@app/events';
import { UserEntity } from '@app/users/user.entity';
import { RefreshTokenEntity } from '@app/auth/refresh-token.entity';
import { MatchEntity } from '@app/matches/entities/match.entity';
import { MatchPlayerEntity } from '@app/matches/entities/match-player.entity';
import { MatchConfirmationEntity } from '@app/matches/entities/match-confirmation.entity';
import { AuditLogEntity } from '@app/matches/entities/audit-log.entity';
import { HealthController } from './health/health.controller.js';
import { MatchesController } from './matches/matches.controller.js';
import { LeaderboardController } from './leaderboard/leaderboard.controller.js';
import { AdminController } from './admin/admin.controller.js';
import { AllExceptionsFilter } from './filters/http-exception.filter.js';

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
        entities: [
          UserEntity,
          RefreshTokenEntity,
          MatchEntity,
          MatchPlayerEntity,
          MatchConfirmationEntity,
          AuditLogEntity,
        ],
        synchronize: false,
        migrationsRun: true,
        migrations: ['dist/migrations/*.js'],
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
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
    ThrottlerModule.forRoot([{ name: 'global', ttl: 60000, limit: 100 }]),
    AuthModule,
    MatchesModule,
    LeaderboardModule,
    DlqInspectorModule,
  ],
  controllers: [HealthController, MatchesController, LeaderboardController, AdminController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
