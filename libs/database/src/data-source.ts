import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { UserEntity } from '../../users/src/user.entity.js';
import { RefreshTokenEntity } from '../../auth/src/refresh-token.entity.js';
import { MatchEntity } from '../../matches/src/entities/match.entity.js';
import { MatchPlayerEntity } from '../../matches/src/entities/match-player.entity.js';
import { MatchConfirmationEntity } from '../../matches/src/entities/match-confirmation.entity.js';
import { AuditLogEntity } from '../../matches/src/entities/audit-log.entity.js';
import { AddUsersTable1715800000001 } from '../../../migrations/001-AddUsersTable.js';
import { AddRefreshTokensTable1715800000002 } from '../../../migrations/002-AddRefreshTokensTable.js';
import { AddMatchesTable1715800000003 } from '../../../migrations/003-AddMatchesTable.js';
import { AddMatchPlayersTable1715800000004 } from '../../../migrations/004-AddMatchPlayersTable.js';
import { AddMatchConfirmationsTable1715800000005 } from '../../../migrations/005-AddMatchConfirmationsTable.js';
import { AddAuditLogsTable1715800000006 } from '../../../migrations/006-AddAuditLogsTable.js';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USER ?? 'foosball',
  password: process.env.DB_PASSWORD ?? 'foosball',
  database: process.env.DB_NAME ?? 'foosball',
  entities: [
    UserEntity,
    RefreshTokenEntity,
    MatchEntity,
    MatchPlayerEntity,
    MatchConfirmationEntity,
    AuditLogEntity,
  ],
  migrations: [
    AddUsersTable1715800000001,
    AddRefreshTokensTable1715800000002,
    AddMatchesTable1715800000003,
    AddMatchPlayersTable1715800000004,
    AddMatchConfirmationsTable1715800000005,
    AddAuditLogsTable1715800000006,
  ],
  synchronize: false,
  migrationsRun: false,
});

export default AppDataSource;
