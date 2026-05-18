/**
 * Shared factory for creating a fully-configured NestJS test application.
 * All external dependencies (TypeORM, Redis, BullMQ) are replaced with
 * in-memory / mock implementations. No real MySQL, Redis, or BullMQ required.
 */
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { getDataSourceToken } from '@nestjs/typeorm';
import { APP_FILTER, APP_GUARD, Reflector } from '@nestjs/core';
import { MatchService } from '@app/matches/services/match.service';
import { ConfirmationService } from '@app/matches/services/confirmation.service';
import { AdminOverrideService } from '@app/matches/services/admin-override.service';
import { MatchRepository } from '@app/matches/repositories/match.repository';
import { MatchEntity } from '@app/matches/entities/match.entity';
import { MatchPlayerEntity } from '@app/matches/entities/match-player.entity';
import { MatchConfirmationEntity } from '@app/matches/entities/match-confirmation.entity';
import { AuditLogEntity } from '@app/matches/entities/audit-log.entity';
import { LeaderboardService, LEADERBOARD_REDIS } from '@app/leaderboard/leaderboard.service';
import { LeaderboardRepository } from '@app/leaderboard/leaderboard.repository';
import { DlqInspectorService } from '@app/events';
import { QUEUE_MATCHES, QUEUE_LEADERBOARD, QUEUE_AUDIT } from '@app/events';
import { JwtAuthGuard, RolesGuard } from '@app/auth';
import { AllExceptionsFilter } from '../../apps/api/src/filters/http-exception.filter';
import { HealthController } from '../../apps/api/src/health/health.controller';
import { MatchesController } from '../../apps/api/src/matches/matches.controller';
import { LeaderboardController } from '../../apps/api/src/leaderboard/leaderboard.controller';
import { AdminController } from '../../apps/api/src/admin/admin.controller';

export const TEST_JWT_SECRET = 'e2e-test-secret';

// ─── In-memory stores ────────────────────────────────────────────────────────

export interface TestStores {
  matches: Map<number, MatchEntity>;
  players: Map<string, MatchPlayerEntity[]>;
  confirmations: Map<number, MatchConfirmationEntity[]>;
  auditLogs: AuditLogEntity[];
  counter: { value: number };
}

export function createStores(): TestStores {
  return {
    matches: new Map(),
    players: new Map(),
    confirmations: new Map(),
    auditLogs: [],
    counter: { value: 1 },
  };
}

// ─── Mock factories ──────────────────────────────────────────────────────────

export function createMockMatchRepository(stores: TestStores) {
  const { matches, players, confirmations, auditLogs, counter } = stores;

  return {
    create: jest.fn().mockImplementation(async (data: Partial<MatchEntity>) => {
      const id = counter.value++;
      const match: MatchEntity = {
        id,
        players: [],
        confirmations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        confirmedAt: null,
        lockedAt: null,
        ...data,
      } as unknown as MatchEntity;
      matches.set(id, match);
      return match;
    }),
    findById: jest.fn().mockImplementation(async (id: number) => matches.get(id) ?? null),
    save: jest.fn().mockImplementation(async (entity: MatchEntity) => {
      matches.set(entity.id, entity);
      return entity;
    }),
    delete: jest.fn().mockImplementation(async (id: number) => { matches.delete(id); }),
    findPaginated: jest.fn().mockImplementation(async (params: any) => {
      const all = Array.from(matches.values());
      const filtered = all.filter((m) => {
        if (params.status && m.status !== params.status) return false;
        if (params.matchType && m.matchType !== params.matchType) return false;
        if (params.createdBy && m.createdBy !== params.createdBy) return false;
        return true;
      });
      return {
        data: filtered.slice(0, params.limit),
        pagination: { limit: params.limit, hasMore: filtered.length > params.limit, nextCursor: null },
      };
    }),
    findPlayers: jest.fn().mockImplementation(async (matchId: number) =>
      players.get(String(matchId)) ?? [],
    ),
    savePlayers: jest.fn().mockImplementation(async (newPlayers: Partial<MatchPlayerEntity>[]) => {
      if (!newPlayers.length) return [];
      const matchId = newPlayers[0]!.matchId!;
      const existing = players.get(String(matchId)) ?? [];
      const created = newPlayers.map((p) => ({ ...p } as MatchPlayerEntity));
      players.set(String(matchId), [...existing, ...created]);
      return created;
    }),
    findConfirmations: jest.fn().mockImplementation(async (matchId: number) =>
      confirmations.get(matchId) ?? [],
    ),
    findConfirmation: jest.fn().mockImplementation(async (matchId: number, userId: number) => {
      const confs = confirmations.get(matchId) ?? [];
      return confs.find((c) => c.userId === userId) ?? null;
    }),
    saveConfirmation: jest.fn().mockImplementation(async (matchId: number, userId: number) => {
      const confs = confirmations.get(matchId) ?? [];
      const conf = { matchId, userId, confirmedAt: new Date() } as unknown as MatchConfirmationEntity;
      confirmations.set(matchId, [...confs, conf]);
      return conf;
    }),
    deleteAllConfirmations: jest.fn().mockImplementation(async (matchId: number) => {
      confirmations.delete(matchId);
    }),
    saveAuditLog: jest.fn().mockImplementation(async (data: Partial<AuditLogEntity>) => {
      const log = { id: counter.value++, createdAt: new Date(), ...data } as unknown as AuditLogEntity;
      auditLogs.push(log);
      return log;
    }),
    findAuditLogs: jest.fn().mockImplementation(async (entityType: string, entityId: number) =>
      auditLogs.filter((l) => l.entityType === entityType && l.entityId === entityId),
    ),
    getDataSource: jest.fn().mockImplementation(() => ({
      createQueryRunner: jest.fn().mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: {
          /** Handles both save(entity) and save(EntityClass, data) patterns */
          save: jest.fn().mockImplementation(async (entityOrClass: any, data?: any) => {
            // save(EntityClass, data) — used for AuditLogEntity in AdminOverrideService
            if (data !== undefined && typeof entityOrClass === 'function') {
              const log = {
                id: counter.value++,
                createdAt: new Date(),
                ...data,
              } as unknown as AuditLogEntity;
              auditLogs.push(log);
              return log;
            }
            // save(entity) — used for MatchEntity and MatchConfirmationEntity
            const entity = entityOrClass;
            if (entity && typeof entity.id === 'number' && 'status' in entity) {
              // MatchEntity
              matches.set(entity.id, entity);
              return entity;
            }
            if (entity && 'matchId' in entity && 'userId' in entity && !('status' in entity)) {
              // MatchConfirmationEntity
              const matchId: number = entity.matchId;
              const conf = { matchId, userId: entity.userId, confirmedAt: new Date() } as unknown as MatchConfirmationEntity;
              const existing = confirmations.get(matchId) ?? [];
              confirmations.set(matchId, [...existing, conf]);
              return conf;
            }
            return entity;
          }),
          create: jest.fn().mockImplementation((_EntityClass: any, data: any) => data),
          /** findOne used by ConfirmationService for pessimistic_write lock on match */
          findOne: jest.fn().mockImplementation(async (_EntityClass: any, options: any) => {
            if (options?.where && 'id' in options.where) {
              return matches.get(options.where.id) ?? null;
            }
            if (options?.where && 'matchId' in options.where && 'userId' in options.where) {
              const confs = confirmations.get(options.where.matchId) ?? [];
              return confs.find((c) => c.userId === options.where.userId) ?? null;
            }
            return null;
          }),
          /** find used by ConfirmationService to re-count confirmations inside tx */
          find: jest.fn().mockImplementation(async (_EntityClass: any, options: any) => {
            if (options?.where && 'matchId' in options.where) {
              return confirmations.get(options.where.matchId) ?? [];
            }
            return [];
          }),
        },
      })),
    })),
  };
}

export function createMockQueue() {
  return { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
}

export function createMockRedis(store?: Map<string, string>) {
  const _store = store ?? new Map<string, string>();
  return {
    get: jest.fn().mockImplementation(async (key: string) => _store.get(key) ?? null),
    set: jest.fn().mockImplementation(async (key: string, value: string) => {
      _store.set(key, value);
      return 'OK';
    }),
    del: jest.fn().mockImplementation(async (...keys: string[]) => {
      for (const k of keys) _store.delete(k);
      return keys.length;
    }),
    _store,
  };
}

// ─── Application builder ─────────────────────────────────────────────────────

export interface TestApp {
  app: NestFastifyApplication;
  jwtService: JwtService;
  stores: TestStores;
  matchRepo: ReturnType<typeof createMockMatchRepository>;
  redis: ReturnType<typeof createMockRedis>;
  queues: {
    matches: ReturnType<typeof createMockQueue>;
    leaderboard: ReturnType<typeof createMockQueue>;
    audit: ReturnType<typeof createMockQueue>;
  };
  leaderboardRepo: { getUserWins: jest.Mock; getPairWins: jest.Mock };
}

export async function buildTestApp(): Promise<TestApp> {
  const stores = createStores();
  const matchRepo = createMockMatchRepository(stores);
  const redisStore = new Map<string, string>();
  const redis = createMockRedis(redisStore);
  const queues = {
    matches: createMockQueue(),
    leaderboard: createMockQueue(),
    audit: createMockQueue(),
  };
  const leaderboardRepo = {
    getUserWins: jest.fn().mockResolvedValue([]),
    getPairWins: jest.fn().mockResolvedValue([]),
  };
  const dlqService = {
    listFailed: jest.fn().mockResolvedValue([]),
    retryJob: jest.fn().mockResolvedValue(undefined),
  };

  const module = await Test.createTestingModule({
    imports: [
      JwtModule.register({ secret: TEST_JWT_SECRET, signOptions: { expiresIn: '1h' } }),
    ],
    controllers: [HealthController, MatchesController, LeaderboardController, AdminController],
    providers: [
      { provide: MatchRepository, useValue: matchRepo },
      { provide: getQueueToken(QUEUE_MATCHES), useValue: queues.matches },
      { provide: getQueueToken(QUEUE_LEADERBOARD), useValue: queues.leaderboard },
      { provide: getQueueToken(QUEUE_AUDIT), useValue: queues.audit },
      MatchService,
      ConfirmationService,
      AdminOverrideService,
      { provide: LEADERBOARD_REDIS, useValue: redis },
      { provide: LeaderboardRepository, useValue: leaderboardRepo },
      LeaderboardService,
      { provide: DlqInspectorService, useValue: dlqService },
      Reflector,
      JwtAuthGuard,
      RolesGuard,
      { provide: APP_GUARD, useClass: JwtAuthGuard },
      { provide: APP_FILTER, useClass: AllExceptionsFilter },
    ],
  })
    .overrideProvider(getDataSourceToken())
    .useValue(matchRepo.getDataSource())
    .compile();

  const app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const jwtService = module.get(JwtService);
  return { app, jwtService, stores, matchRepo, redis, queues, leaderboardRepo };
}

export function signJwt(jwtService: JwtService, sub: number, isAdmin = false): string {
  return jwtService.sign({
    sub,
    email: `user${sub}@test.com`,
    is_admin: isAdmin,
    azure_oid: `oid-${sub}`,
  });
}
