/**
 * E2E Scenario 1 — Full match lifecycle: create → players → result
 * test-criteria.md §SCENARIO 1
 */
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { buildTestApp, signJwt, createStores, TestApp } from './helpers/test-app.factory';

describe('Scenario 1 — Match Lifecycle', () => {
  let testApp: TestApp;
  let app: NestFastifyApplication;
  let jwtService: JwtService;
  let http: ReturnType<typeof request.default>;

  beforeAll(async () => {
    testApp = await buildTestApp();
    app = testApp.app;
    jwtService = testApp.jwtService;
    http = request.default(app.getHttpServer());
  });

  beforeEach(() => {
    // Reset stores between tests
    const fresh = createStores();
    Object.assign(testApp.stores.matches, fresh.matches);
    Object.assign(testApp.stores.players, fresh.players);
    Object.assign(testApp.stores.confirmations, fresh.confirmations);
    testApp.stores.matches.clear();
    testApp.stores.players.clear();
    testApp.stores.confirmations.clear();
    testApp.stores.auditLogs.splice(0);
    testApp.stores.counter.value = 1;
  });

  afterAll(async () => {
    await app.close();
  });

  // 1a — Happy path: create → add players → submit result
  it('1a: create 2v2 → 201, add 4 players → 200, submit result → 200 awaiting_confirmation', async () => {
    const token = signJwt(jwtService, 1);

    const createRes = await http
      .post('/api/v1/matches')
      .set('Authorization', `Bearer ${token}`)
      .send({ matchType: '2v2' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.matchType).toBe('2v2');
    expect(createRes.body.status).toBe('draft');
    expect(createRes.body.players).toEqual([]);
    const matchId = createRes.body.id;

    const playersRes = await http
      .post(`/api/v1/matches/${matchId}/players`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        players: [
          { userId: 1, team: 'A', slot: 1 },
          { userId: 2, team: 'A', slot: 2 },
          { userId: 3, team: 'B', slot: 1 },
          { userId: 4, team: 'B', slot: 2 },
        ],
      });

    expect(playersRes.status).toBe(200);
    expect(playersRes.body.players).toHaveLength(4);

    const resultRes = await http
      .post(`/api/v1/matches/${matchId}/result`)
      .set('Authorization', `Bearer ${token}`)
      .send({ scoreA: 5, scoreB: 3 });

    expect(resultRes.status).toBe(200);
    expect(resultRes.body.status).toBe('awaiting_confirmation');
    expect(resultRes.body.scoreA).toBe(5);
    expect(resultRes.body.scoreB).toBe(3);
  });

  // 1b — Default matchType is 2v2
  it('1b: POST /matches without matchType → 201, defaults to 2v2', async () => {
    const token = signJwt(jwtService, 1);

    const res = await http
      .post('/api/v1/matches')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.matchType).toBe('2v2');
  });

  // 1c — Invalid matchType rejected
  it('1c: POST /matches with matchType "3v3" → 400', async () => {
    const token = signJwt(jwtService, 1);

    const res = await http
      .post('/api/v1/matches')
      .set('Authorization', `Bearer ${token}`)
      .send({ matchType: '3v3' });

    expect(res.status).toBe(400);
  });

  // 1d — Non-creator cannot add players
  it('1d: non-creator addPlayers → 403 FORBIDDEN_NOT_CREATOR', async () => {
    const token1 = signJwt(jwtService, 1);
    const token2 = signJwt(jwtService, 2);

    const createRes = await http
      .post('/api/v1/matches')
      .set('Authorization', `Bearer ${token1}`)
      .send({ matchType: '2v2' });
    const matchId = createRes.body.id;

    const res = await http
      .post(`/api/v1/matches/${matchId}/players`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ players: [{ userId: 5, team: 'A', slot: 1 }] });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_NOT_CREATOR');
  });

  // 1e — Capacity exceeded
  it('1e: adding 5th player to full 2v2 match → 400 CAPACITY_EXCEEDED', async () => {
    const token = signJwt(jwtService, 1);

    const createRes = await http
      .post('/api/v1/matches')
      .set('Authorization', `Bearer ${token}`)
      .send({ matchType: '2v2' });
    const matchId = createRes.body.id;

    await http
      .post(`/api/v1/matches/${matchId}/players`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        players: [
          { userId: 1, team: 'A', slot: 1 },
          { userId: 2, team: 'A', slot: 2 },
          { userId: 3, team: 'B', slot: 1 },
          { userId: 4, team: 'B', slot: 2 },
        ],
      });

    const res = await http
      .post(`/api/v1/matches/${matchId}/players`)
      .set('Authorization', `Bearer ${token}`)
      .send({ players: [{ userId: 5, team: 'A', slot: 1 }] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CAPACITY_EXCEEDED');
  });

  // 1f — Insufficient players
  it('1f: submitResult with only 3 players → 400 INSUFFICIENT_PLAYERS', async () => {
    const token = signJwt(jwtService, 1);

    const createRes = await http
      .post('/api/v1/matches')
      .set('Authorization', `Bearer ${token}`)
      .send({ matchType: '2v2' });
    const matchId = createRes.body.id;

    await http
      .post(`/api/v1/matches/${matchId}/players`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        players: [
          { userId: 1, team: 'A', slot: 1 },
          { userId: 2, team: 'A', slot: 2 },
          { userId: 3, team: 'B', slot: 1 },
        ],
      });

    const res = await http
      .post(`/api/v1/matches/${matchId}/result`)
      .set('Authorization', `Bearer ${token}`)
      .send({ scoreA: 5, scoreB: 3 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INSUFFICIENT_PLAYERS');
  });

  // 1g — Unauthenticated
  it('1g: no auth header → 401', async () => {
    const res = await http
      .post('/api/v1/matches')
      .send({ matchType: '2v2' });

    expect(res.status).toBe(401);
  });
});
