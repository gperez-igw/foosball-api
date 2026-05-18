/**
 * E2E test helpers — creates a NestJS application with all real modules
 * but replaces external dependencies (TypeORM, Redis, BullMQ) with in-memory
 * or mock implementations.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { JwtService } from '@nestjs/jwt';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MatchService } from '@app/matches/services/match.service';
import { ConfirmationService } from '@app/matches/services/confirmation.service';
import { AdminOverrideService } from '@app/matches/services/admin-override.service';
import { MatchRepository } from '@app/matches/repositories/match.repository';
import { LeaderboardService, LEADERBOARD_REDIS } from '@app/leaderboard/leaderboard.service';
import { LeaderboardRepository } from '@app/leaderboard/leaderboard.repository';
import { QUEUE_MATCHES, QUEUE_LEADERBOARD, QUEUE_AUDIT } from '@app/events';
import { DlqInspectorService } from '@app/events';
import { AppModule } from '../src/app.module';
import type { JwtPayload } from '@app/auth';

/** Minimal mock queue that resolves immediately */
export function createMockQueue() {
  return {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    getFailed: jest.fn().mockResolvedValue([]),
    getJob: jest.fn().mockResolvedValue(null),
  };
}

/** Mock Redis for leaderboard */
export function createMockRedis() {
  const store = new Map<string, string>();
  return {
    get: jest.fn().mockImplementation(async (key: string) => store.get(key) ?? null),
    set: jest.fn().mockImplementation(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    del: jest.fn().mockImplementation(async (...keys: string[]) => {
      for (const k of keys) store.delete(k);
      return keys.length;
    }),
    _store: store,
  };
}

/**
 * Sign a JWT for testing using the module's JwtService.
 * Uses the same secret configured in the app (JWT_SECRET env or default 'test-secret').
 */
export function signTestJwt(
  jwtService: JwtService,
  payload: Partial<JwtPayload> & { sub: number },
): string {
  return jwtService.sign({
    sub: payload.sub,
    email: payload.email ?? `user${payload.sub}@test.com`,
    is_admin: payload.is_admin ?? false,
    azure_oid: payload.azure_oid ?? `oid-${payload.sub}`,
  });
}
