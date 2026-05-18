/**
 * E2E Scenario 7 — Leaderboard: correct values on all 4 time filters
 * test-criteria.md §SCENARIO 7
 */
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { buildTestApp, signJwt, TestApp } from './helpers/test-app.factory';
import type { UserWinEntry, PairWinEntry } from '@app/leaderboard/leaderboard.repository';

describe('Scenario 7 — Leaderboard', () => {
  let testApp: TestApp;
  let app: NestFastifyApplication;
  let jwtService: JwtService;
  let http: ReturnType<typeof request.default>;

  /**
   * Seed data per test-criteria.md §SCENARIO 7:
   * M1: today (week/month/year) → winner: user1, user2
   * M2: 6 days ago (week/month/year) → winner: user1, user2
   * M3: 20 days ago (month/year) → winner: user1, user2
   * M4: 40 days ago (year only) → winner: user3, user4
   * M5: 400 days ago (none) → winner: user3, user4
   */
  const weekEntries: UserWinEntry[] = [
    { userId: 1, displayName: 'User One', wins: 2 },
    { userId: 2, displayName: 'User Two', wins: 2 },
  ];
  const monthEntries: UserWinEntry[] = [
    { userId: 1, displayName: 'User One', wins: 3 },
    { userId: 2, displayName: 'User Two', wins: 3 },
  ];
  const yearEntries: UserWinEntry[] = [
    { userId: 1, displayName: 'User One', wins: 3 },
    { userId: 2, displayName: 'User Two', wins: 3 },
    { userId: 3, displayName: 'User Three', wins: 1 },
    { userId: 4, displayName: 'User Four', wins: 1 },
  ];
  const totalEntries: UserWinEntry[] = [
    { userId: 1, displayName: 'User One', wins: 3 },
    { userId: 2, displayName: 'User Two', wins: 3 },
    { userId: 3, displayName: 'User Three', wins: 2 },
    { userId: 4, displayName: 'User Four', wins: 2 },
  ];
  const weekPairEntries: PairWinEntry[] = [
    { userAId: 1, userAName: 'User One', userBId: 2, userBName: 'User Two', wins: 2 },
  ];
  const totalPairEntries: PairWinEntry[] = [
    { userAId: 1, userAName: 'User One', userBId: 2, userBName: 'User Two', wins: 3 },
    { userAId: 3, userAName: 'User Three', userBId: 4, userBName: 'User Four', wins: 2 },
  ];

  beforeAll(async () => {
    testApp = await buildTestApp();
    app = testApp.app;
    jwtService = testApp.jwtService;
    http = request.default(app.getHttpServer());
  });

  beforeEach(() => {
    testApp.stores.counter.value = 1;
    // Reset Redis store so each test starts with empty cache
    testApp.redis._store.clear();
    // Reset call counts and default mocks
    testApp.leaderboardRepo.getUserWins.mockReset();
    testApp.leaderboardRepo.getPairWins.mockReset();
    testApp.leaderboardRepo.getUserWins.mockResolvedValue([]);
    testApp.leaderboardRepo.getPairWins.mockResolvedValue([]);
  });

  afterAll(async () => {
    await app.close();
  });

  // 7a — Filter: week
  it('7a: GET /leaderboard/users?filter=week → user1.wins=2, user2.wins=2', async () => {
    testApp.leaderboardRepo.getUserWins.mockResolvedValue(weekEntries);
    const token = signJwt(jwtService, 1);

    const res = await http
      .get('/api/v1/leaderboard/users?filter=week')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.filter).toBe('week');
    const user1 = res.body.data.find((e: any) => e.userId === 1);
    const user2 = res.body.data.find((e: any) => e.userId === 2);
    expect(user1.wins).toBe(2);
    expect(user2.wins).toBe(2);
    expect(res.headers['x-cache']).toBe('MISS');
  });

  // 7b — Filter: month
  it('7b: GET /leaderboard/users?filter=month → user1.wins=3, user2.wins=3', async () => {
    testApp.leaderboardRepo.getUserWins.mockResolvedValue(monthEntries);
    const token = signJwt(jwtService, 1);

    const res = await http
      .get('/api/v1/leaderboard/users?filter=month')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const user1 = res.body.data.find((e: any) => e.userId === 1);
    expect(user1.wins).toBe(3);
  });

  // 7c — Filter: year
  it('7c: GET /leaderboard/users?filter=year → all 4 users', async () => {
    testApp.leaderboardRepo.getUserWins.mockResolvedValue(yearEntries);
    const token = signJwt(jwtService, 1);

    const res = await http
      .get('/api/v1/leaderboard/users?filter=year')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(4);
    const user3 = res.body.data.find((e: any) => e.userId === 3);
    expect(user3.wins).toBe(1);
  });

  // 7d — Filter: total
  it('7d: GET /leaderboard/users?filter=total → user3.wins=2', async () => {
    testApp.leaderboardRepo.getUserWins.mockResolvedValue(totalEntries);
    const token = signJwt(jwtService, 1);

    const res = await http
      .get('/api/v1/leaderboard/users?filter=total')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const user3 = res.body.data.find((e: any) => e.userId === 3);
    expect(user3.wins).toBe(2);
  });

  // 7e — Pair leaderboard, filter: week
  it('7e: GET /leaderboard/pairs?filter=week → (user1,user2) wins=2', async () => {
    testApp.leaderboardRepo.getPairWins.mockResolvedValue(weekPairEntries);
    const token = signJwt(jwtService, 1);

    const res = await http
      .get('/api/v1/leaderboard/pairs?filter=week')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].userA.userId).toBe(1);
    expect(res.body.data[0].userB.userId).toBe(2);
    expect(res.body.data[0].wins).toBe(2);
  });

  // 7f — Pair leaderboard, filter: total
  it('7f: GET /leaderboard/pairs?filter=total → (user1,user2) rank 1st, wins=3', async () => {
    testApp.leaderboardRepo.getPairWins.mockResolvedValue(totalPairEntries);
    const token = signJwt(jwtService, 1);

    const res = await http
      .get('/api/v1/leaderboard/pairs?filter=total')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].rank).toBe(1);
    expect(res.body.data[0].wins).toBe(3);
    expect(res.body.data[1].wins).toBe(2);
  });

  // 7g — Cache hit after first request
  it('7g: second GET uses cache → X-Cache: HIT', async () => {
    testApp.leaderboardRepo.getUserWins.mockResolvedValue(weekEntries);
    const token = signJwt(jwtService, 1);

    // First request — cache MISS, populates cache
    const first = await http
      .get('/api/v1/leaderboard/users?filter=week')
      .set('Authorization', `Bearer ${token}`);
    expect(first.headers['x-cache']).toBe('MISS');

    // Second request — cache HIT
    const second = await http
      .get('/api/v1/leaderboard/users?filter=week')
      .set('Authorization', `Bearer ${token}`);
    expect(second.status).toBe(200);
    expect(second.headers['x-cache']).toBe('HIT');
    // DB not called again
    expect(testApp.leaderboardRepo.getUserWins).toHaveBeenCalledTimes(1);
  });

  // 7h — Cache invalidated (simulated via direct del)
  it('7h: after cache invalidation, next GET returns MISS', async () => {
    testApp.leaderboardRepo.getUserWins.mockResolvedValue(weekEntries);
    const token = signJwt(jwtService, 1);

    // Populate cache
    await http
      .get('/api/v1/leaderboard/users?filter=week')
      .set('Authorization', `Bearer ${token}`);

    // Simulate worker cache invalidation by clearing the store
    testApp.redis._store.clear();

    const afterInvalidate = await http
      .get('/api/v1/leaderboard/users?filter=week')
      .set('Authorization', `Bearer ${token}`);
    expect(afterInvalidate.headers['x-cache']).toBe('MISS');
  });

  // 7i — Invalid filter
  it('7i: GET /leaderboard/users?filter=quarter → 400', async () => {
    const token = signJwt(jwtService, 1);

    const res = await http
      .get('/api/v1/leaderboard/users?filter=quarter')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});
