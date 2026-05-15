import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { UserEntity } from '../../users/src/user.entity.js';
import { RefreshTokenEntity } from '../../auth/src/refresh-token.entity.js';
import { AddUsersTable1715800000001 } from '../../../migrations/001-AddUsersTable.js';
import { AddRefreshTokensTable1715800000002 } from '../../../migrations/002-AddRefreshTokensTable.js';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USER ?? 'foosball',
  password: process.env.DB_PASSWORD ?? 'foosball',
  database: process.env.DB_NAME ?? 'foosball',
  entities: [UserEntity, RefreshTokenEntity],
  migrations: [AddUsersTable1715800000001, AddRefreshTokensTable1715800000002],
  synchronize: false,
  migrationsRun: false,
});

export default AppDataSource;
