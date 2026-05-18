import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { MatchEntity } from './entities/match.entity.js';
import { MatchPlayerEntity } from './entities/match-player.entity.js';
import { MatchConfirmationEntity } from './entities/match-confirmation.entity.js';
import { AuditLogEntity } from './entities/audit-log.entity.js';
import { MatchRepository } from './repositories/match.repository.js';
import { MatchService } from './services/match.service.js';
import { ConfirmationService } from './services/confirmation.service.js';
import { AdminOverrideService } from './services/admin-override.service.js';
import { QUEUE_MATCHES, QUEUE_LEADERBOARD, QUEUE_AUDIT, defaultJobOptions } from '@app/events';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MatchEntity,
      MatchPlayerEntity,
      MatchConfirmationEntity,
      AuditLogEntity,
    ]),
    BullModule.registerQueue(
      { name: QUEUE_MATCHES, defaultJobOptions },
      { name: QUEUE_LEADERBOARD, defaultJobOptions },
      { name: QUEUE_AUDIT, defaultJobOptions },
    ),
  ],
  providers: [MatchRepository, MatchService, ConfirmationService, AdminOverrideService],
  exports: [MatchService, ConfirmationService, AdminOverrideService, MatchRepository],
})
export class MatchesModule {}
