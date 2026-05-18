/**
 * E2E tests — Scenario 6: Azure SSO login (6a–6h)
 * test-criteria.md § SCENARIO 6
 *
 * Strategy: build the auth app as a TestingModule with all external I/O fully
 * mocked so no real DB, Redis, or Azure AD calls are made.
 * - MSAL / Azure AD: jest.mock('@azure/msal-node')
 * - TypeORM: repositories injected as in-memory mock objects
 * - JWT: real @nestjs/jwt with a fixed test secret so we can decode tokens
 * - Config: overrideProvider for ConfigService with fixed test values
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus, Module } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { JwtService, JwtModule } from '@nestjs/jwt';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import * as request from 'supertest';
import * as crypto from 'crypto';

// ── Module-level mock — must appear before any import that uses @azure/msal-node
jest.mock('@azure/msal-node');

// ── Source imports (after mocks) ──────────────────────────────────────────────
import { AuthModule } from '../libs/auth/src/auth.module';
import { UsersModule } from '../libs/users/src/users.module';
import { AuthController } from '../apps/auth/src/auth.controller';
import { UsersController } from '../apps/auth/src/users.controller';
import { JwtAuthGuard } from '../libs/auth/src/jwt-auth.guard';
import { UserEntity } from '../libs/users/src/user.entity';
import { RefreshTokenEntity } from '../libs/auth/src/refresh-token.entity';
import { UserRepository } from '../libs/users/src/user.repository';

import * as msalNode from '@azure/msal-node';

// ── Constants ─────────────────────────────────────────────────────────────────
const ADMIN_GROUP_ID = 'admin-azure-group-id';
const JWT_SECRET = 'test-secret-that-is-long-enough-32';
const AZURE_OID = 'oid-user-001';
const USER_EMAIL = 'player@foosball.test';
const DISPLAY_NAME = 'Test Player';

// ── Test config values ────────────────────────────────────────────────────────
const TEST_CONFIG: Record<string, string | number> = {
  AZURE_TENANT_ID: 'test-tenant',
  AZURE_CLIENT_ID: 'test-client-id',
  AZURE_CLIENT_SECRET: 'test-client-secret',
  AZURE_REDIRECT_URI: 'http://localhost/auth/callback',
  ADMIN_AZURE_GROUP_ID: ADMIN_GROUP_ID,
  JWT_SECRET,
  DB_HOST: 'localhost',
  DB_PORT: 3306,
  DB_USER: 'test',
  DB_PASSWORD: 'test',
  DB_NAME: 'test',
};

// ── Mock fetch (used by AzureAdService.getGroupsFromGraph) ────────────────────
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ── MSAL mock client ──────────────────────────────────────────────────────────
const mockMsalClient = {
  getAuthCodeUrl: jest.fn().mockResolvedValue('https://login.microsoftonline.com/authorize'),
  acquireTokenByCode: jest.fn(),
};

function buildMsalResult(groups?: string[], claimNames?: Record<string, string>) {
  return {
    accessToken: 'mock-graph-access-token',
    idTokenClaims: {
      oid: AZURE_OID,
      preferred_username: USER_EMAIL,
      name: DISPLAY_NAME,
      ...(groups !== undefined ? { groups } : {}),
      ...(claimNames ? { _claim_names: claimNames } : {}),
    },
  };
}

// ── In-memory stores ──────────────────────────────────────────────────────────
let users: Map<string, UserEntity>;       // keyed by azureOid
let userById: Map<number, UserEntity>;    // keyed by id
let tokens: Map<string, RefreshTokenEntity>; // keyed by tokenHash
let tokenIdSeq: number;
let userIdSeq: number;

function resetStores() {
  users = new Map();
  userById = new Map();
  tokens = new Map();
  tokenIdSeq = 1;
  userIdSeq = 1;
}

function makeUserRepoMock() {
  return {
    findOne: jest.fn(({ where }: { where: Partial<UserEntity> }) => {
      if (where.azureOid) return Promise.resolve(users.get(where.azureOid) ?? null);
      if (where.id) return Promise.resolve(userById.get(where.id as number) ?? null);
      return Promise.resolve(null);
    }),
    create: jest.fn((data: Partial<UserEntity>) => Object.assign(new UserEntity(), data)),
    save: jest.fn((entity: UserEntity) => {
      if (users.has(entity.azureOid)) {
        const existing = users.get(entity.azureOid)!;
        Object.assign(existing, entity);
        userById.set(existing.id, existing);
        return Promise.resolve(existing);
      }
      const id = userIdSeq++;
      entity.id = id;
      entity.createdAt = entity.createdAt ?? new Date();
      entity.updatedAt = new Date();
      users.set(entity.azureOid, entity);
      userById.set(id, entity);
      return Promise.resolve(entity);
    }),
    update: jest.fn((id: number, data: Partial<UserEntity>) => {
      const u = userById.get(id);
      if (u) Object.assign(u, data);
      return Promise.resolve({ affected: u ? 1 : 0 });
    }),
  };
}

function makeRefreshTokenRepoMock() {
  return {
    create: jest.fn((data: Partial<RefreshTokenEntity>) =>
      Object.assign(new RefreshTokenEntity(), data),
    ),
    save: jest.fn((entity: RefreshTokenEntity) => {
      if (!entity.id) entity.id = tokenIdSeq++;
      entity.createdAt = entity.createdAt ?? new Date();
      tokens.set(entity.tokenHash, { ...entity });
      return Promise.resolve(entity);
    }),
    findOne: jest.fn(({ where }: { where: Partial<RefreshTokenEntity> }) => {
      if (where.tokenHash) return Promise.resolve(tokens.get(where.tokenHash) ?? null);
      return Promise.resolve(null);
    }),
    update: jest.fn((criteria: number | Partial<RefreshTokenEntity>, data: Partial<RefreshTokenEntity>) => {
      const id = typeof criteria === 'number' ? criteria : undefined;
      const hash = typeof criteria === 'object' ? criteria.tokenHash : undefined;
      tokens.forEach((tok, k) => {
        if ((id && tok.id === id) || (hash && tok.tokenHash === hash)) {
          tokens.set(k, { ...tok, ...data });
        }
      });
      return Promise.resolve({ affected: 1 });
    }),
  };
}

// ── Test helpers ──────────────────────────────────────────────────────────────
async function seedUser(overrides: Partial<UserEntity> = {}): Promise<UserEntity> {
  const u = new UserEntity();
  const id = userIdSeq++;
  u.id = id;
  u.azureOid = overrides.azureOid ?? AZURE_OID;
  u.email = overrides.email ?? USER_EMAIL;
  u.displayName = overrides.displayName ?? DISPLAY_NAME;
  u.isAdmin = overrides.isAdmin ?? false;
  u.createdAt = new Date();
  u.updatedAt = new Date();
  users.set(u.azureOid, u);
  userById.set(u.id, u);
  return u;
}

async function seedRefreshToken(userId: number, ttlMs = 86400000): Promise<string> {
  const raw = crypto.randomBytes(48).toString('base64url');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const entity = new RefreshTokenEntity();
  entity.id = tokenIdSeq++;
  entity.userId = userId;
  entity.tokenHash = hash;
  entity.expiresAt = new Date(Date.now() + ttlMs);
  entity.usedAt = null;
  entity.replacedBy = null;
  entity.createdAt = new Date();
  tokens.set(hash, entity);
  return raw;
}

// ── Test module ───────────────────────────────────────────────────────────────

describe('Scenario 6 — Azure SSO login (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let userRepoMock: ReturnType<typeof makeUserRepoMock>;
  let refreshTokenRepoMock: ReturnType<typeof makeRefreshTokenRepoMock>;

  beforeAll(async () => {
    resetStores();

    userRepoMock = makeUserRepoMock();
    refreshTokenRepoMock = makeRefreshTokenRepoMock();

    // Wire MSAL mock
    (msalNode.ConfidentialClientApplication as jest.Mock).mockImplementation(
      () => mockMsalClient,
    );
    mockMsalClient.acquireTokenByCode.mockResolvedValue(
      buildMsalResult([ADMIN_GROUP_ID]),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 1000 }]),
        JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '15m' } }),
        AuthModule,
        UsersModule,
      ],
      controllers: [AuthController, UsersController],
      providers: [
        {
          provide: APP_GUARD,
          useClass: JwtAuthGuard,
        },
      ],
    })
      // Override ConfigService so no real env vars needed
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn((key: string, def?: unknown) => TEST_CONFIG[key] ?? def),
        getOrThrow: jest.fn((key: string) => {
          if (TEST_CONFIG[key] === undefined) throw new Error(`Config key "${key}" not found`);
          return TEST_CONFIG[key];
        }),
      })
      // Override TypeORM repositories with in-memory mocks
      .overrideProvider(getRepositoryToken(UserEntity))
      .useValue(userRepoMock)
      .overrideProvider(getRepositoryToken(RefreshTokenEntity))
      .useValue(refreshTokenRepoMock)
      // Override UserRepository (which wraps the TypeORM repo)
      .overrideProvider(UserRepository)
      .useValue({
        findByAzureOid: jest.fn((oid: string) => Promise.resolve(users.get(oid) ?? null)),
        findById: jest.fn((id: number) => Promise.resolve(userById.get(id) ?? null)),
        upsert: jest.fn(async (data: { azureOid: string; email: string; displayName: string; isAdmin: boolean }) => {
          const existing = users.get(data.azureOid);
          if (existing) {
            existing.email = data.email;
            existing.displayName = data.displayName;
            existing.isAdmin = data.isAdmin;
            existing.updatedAt = new Date();
            return existing;
          }
          const u = new UserEntity();
          u.id = userIdSeq++;
          u.azureOid = data.azureOid;
          u.email = data.email;
          u.displayName = data.displayName;
          u.isAdmin = data.isAdmin;
          u.createdAt = new Date();
          u.updatedAt = new Date();
          users.set(u.azureOid, u);
          userById.set(u.id, u);
          return u;
        }),
        updateDisplayName: jest.fn(async (id: number, displayName: string) => {
          const u = userById.get(id);
          if (u) { u.displayName = displayName; }
          return u ?? null;
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  beforeEach(() => {
    resetStores();
    mockFetch.mockReset();
    mockMsalClient.acquireTokenByCode.mockResolvedValue(buildMsalResult([ADMIN_GROUP_ID]));
  });

  afterAll(async () => {
    await app.close();
  });

  // ── 6a. Successful login — groups claim present, user is admin ──────────────
  describe('6a — successful login with admin group in token', () => {
    it('returns 200 with accessToken, refreshToken, expiresIn:900 and is_admin:true in JWT', async () => {
      mockMsalClient.acquireTokenByCode.mockResolvedValue(
        buildMsalResult([ADMIN_GROUP_ID, 'other-group']),
      );

      const res = await request(app.getHttpServer()).get(
        '/auth/callback?code=auth-code&state=state',
      );

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.expiresIn).toBe(900);

      const payload = jwtService.decode(res.body.accessToken) as Record<string, unknown>;
      expect(payload.is_admin).toBe(true);
      expect(payload.email).toBe(USER_EMAIL);
      expect(payload.sub).toBeDefined();

      // users table has is_admin=true
      const savedUser = users.get(AZURE_OID);
      expect(savedUser).toBeDefined();
      expect(savedUser!.isAdmin).toBe(true);

      // refresh_tokens row exists and used_at is null
      const tokenRows = Array.from(tokens.values());
      expect(tokenRows.length).toBeGreaterThan(0);
      const tokenRow = tokenRows[tokenRows.length - 1];
      expect(tokenRow.usedAt).toBeNull();
    });
  });

  // ── 6b. Regular user (not in admin group) ──────────────────────────────────
  describe('6b — regular user not in admin group', () => {
    it('returns 200 with is_admin:false in JWT and users.is_admin=false', async () => {
      mockMsalClient.acquireTokenByCode.mockResolvedValue(buildMsalResult(['other-group']));

      const res = await request(app.getHttpServer()).get(
        '/auth/callback?code=auth-code&state=state',
      );

      expect(res.status).toBe(HttpStatus.OK);
      const payload = jwtService.decode(res.body.accessToken) as Record<string, unknown>;
      expect(payload.is_admin).toBe(false);

      const savedUser = users.get(AZURE_OID);
      expect(savedUser!.isAdmin).toBe(false);
    });
  });

  // ── 6c. GET /auth/me returns correct profile ────────────────────────────────
  describe('6c — GET /auth/me returns correct user profile', () => {
    it('returns 200 with id, email, displayName, isAdmin', async () => {
      const user = await seedUser({ isAdmin: true });
      const accessToken = jwtService.sign({
        sub: user.id,
        email: USER_EMAIL,
        is_admin: true,
        azure_oid: AZURE_OID,
      });

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.id).toBe(user.id);
      expect(res.body.email).toBe(USER_EMAIL);
      expect(res.body.displayName).toBe(DISPLAY_NAME);
      expect(res.body.isAdmin).toBe(true);
    });
  });

  // ── 6d. Token refresh — single-use rotation ─────────────────────────────────
  describe('6d — POST /auth/refresh single-use rotation', () => {
    it('issues T2 from T1 and rejects T1 on second use', async () => {
      mockMsalClient.acquireTokenByCode.mockResolvedValue(buildMsalResult([ADMIN_GROUP_ID]));

      const callbackRes = await request(app.getHttpServer()).get(
        '/auth/callback?code=auth-code&state=state',
      );
      expect(callbackRes.status).toBe(HttpStatus.OK);
      const t1 = callbackRes.body.refreshToken as string;

      // First refresh: T1 → T2
      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: t1 });

      expect(refreshRes.status).toBe(HttpStatus.OK);
      expect(refreshRes.body).toHaveProperty('accessToken');
      expect(refreshRes.body).toHaveProperty('refreshToken');
      const t2 = refreshRes.body.refreshToken as string;
      expect(t2).not.toBe(t1);

      // Second use of T1 must fail
      const replayRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: t1 });

      expect(replayRes.status).toBe(HttpStatus.UNAUTHORIZED);
      const errorCode = replayRes.body?.code ?? replayRes.body?.error ?? JSON.stringify(replayRes.body);
      expect(errorCode).toMatch(/INVALID_REFRESH_TOKEN/);
    });
  });

  // ── 6e. Expired refresh token rejected ──────────────────────────────────────
  describe('6e — expired refresh token is rejected', () => {
    it('returns 401 INVALID_REFRESH_TOKEN for a token with expires_at in the past', async () => {
      const user = await seedUser();
      const raw = crypto.randomBytes(48).toString('base64url');
      const hash = crypto.createHash('sha256').update(raw).digest('hex');

      const expired = new RefreshTokenEntity();
      expired.id = tokenIdSeq++;
      expired.userId = user.id;
      expired.tokenHash = hash;
      expired.expiresAt = new Date(Date.now() - 60000); // expired 1 min ago
      expired.usedAt = null;
      expired.replacedBy = null;
      expired.createdAt = new Date();
      tokens.set(hash, expired);

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: raw });

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
      const errorCode = res.body?.code ?? res.body?.error ?? JSON.stringify(res.body);
      expect(errorCode).toMatch(/INVALID_REFRESH_TOKEN/);
    });
  });

  // ── 6f. Graph API fallback when groups claim absent (cap exceeded) ───────────
  describe('6f — Graph API fallback when groups claim exceeds cap', () => {
    it('uses Graph API groups and assigns is_admin:true when admin group returned', async () => {
      mockMsalClient.acquireTokenByCode.mockResolvedValue(
        buildMsalResult(undefined, { groups: 'src1' }),
      );
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [{ id: ADMIN_GROUP_ID }, { id: 'other-id' }] }),
      });

      const res = await request(app.getHttpServer()).get(
        '/auth/callback?code=auth-code&state=state',
      );

      expect(res.status).toBe(HttpStatus.OK);
      const payload = jwtService.decode(res.body.accessToken) as Record<string, unknown>;
      expect(payload.is_admin).toBe(true);

      const savedUser = users.get(AZURE_OID);
      expect(savedUser!.isAdmin).toBe(true);
    });
  });

  // ── 6g. Graph API unavailable ────────────────────────────────────────────────
  describe('6g — Graph API unavailable returns 503 AZURE_GRAPH_UNAVAILABLE', () => {
    it('returns 503 when both Graph API attempts fail', async () => {
      mockMsalClient.acquireTokenByCode.mockResolvedValue(
        buildMsalResult(undefined, { groups: 'src1' }),
      );
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: false, status: 503 });

      const res = await request(app.getHttpServer()).get(
        '/auth/callback?code=auth-code&state=state',
      );

      expect(res.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      // ServiceUnavailableException body may have the code at different levels
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).toMatch(/AZURE_GRAPH_UNAVAILABLE/);
    });
  });

  // ── 6h. Logout invalidates refresh token ────────────────────────────────────
  describe('6h — POST /auth/logout invalidates refresh token', () => {
    it('204 on logout, then 401 when refresh token is reused', async () => {
      mockMsalClient.acquireTokenByCode.mockResolvedValue(buildMsalResult([ADMIN_GROUP_ID]));

      const callbackRes = await request(app.getHttpServer()).get(
        '/auth/callback?code=auth-code&state=state',
      );
      expect(callbackRes.status).toBe(HttpStatus.OK);
      const t1 = callbackRes.body.refreshToken as string;
      const accessToken = callbackRes.body.accessToken as string;

      const logoutRes = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken: t1 });

      expect(logoutRes.status).toBe(HttpStatus.NO_CONTENT);

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: t1 });

      expect(refreshRes.status).toBe(HttpStatus.UNAUTHORIZED);
    });
  });
});
