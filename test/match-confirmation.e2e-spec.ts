/**
 * E2E Scenario 2 — Confirmation quorum: quorum reached → result immutable
 * test-criteria.md §SCENARIO 2
 */
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { buildTestApp, signJwt, TestApp } from './helpers/test-app.factory';
import type { MatchEntity } from '@app/matches/entities/match.entity';
import type { MatchPlayerEntity } from '@app/matches/entities/match-player.entity';
import type { MatchConfirmationEntity } from '@app/matches/entities/match-confirmation.entity';

describe('Scenario 2 — Confirmation Quorum', () => {
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
    testApp.stores.matches.clear();
    testApp.stores.players.clear();
    testApp.stores.confirmations.clear();
    testApp.stores.auditLogs.splice(0);
    testApp.stores.counter.value = 1;
  });

  afterAll(async () => {
    await app.close();
  });

  /** Helper: create a match in awaiting_confirmation with 4 players */
  async function seedAwaitingMatch(): Promise<number> {
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

    await http
      .post(`/api/v1/matches/${matchId}/result`)
      .set('Authorization', `Bearer ${token}`)
      .send({ scoreA: 5, scoreB: 3 });

    return matchId;
  }

  // 2a — Quorum reached → match becomes confirmed
  it('2a: 3 confirmations reach quorum → match confirmed', async () => {
    const matchId = await seedAwaitingMatch();

    // User 1 confirms
    let res = await http
      .post(`/api/v1/matches/${matchId}/confirmations`)
      .set('Authorization', `Bearer ${signJwt(jwtService, 1)}`);
    expect(res.status).toBe(200);
    expect(res.body.confirmedCount).toBe(1);
    expect(res.body.quorumReached).toBe(false);

    // User 3 confirms
    res = await http
      .post(`/api/v1/matches/${matchId}/confirmations`)
      .set('Authorization', `Bearer ${signJwt(jwtService, 3)}`);
    expect(res.body.confirmedCount).toBe(2);
    expect(res.body.quorumReached).toBe(false);

    // User 4 confirms — quorum reached (3 of 3 required)
    res = await http
      .post(`/api/v1/matches/${matchId}/confirmations`)
      .set('Authorization', `Bearer ${signJwt(jwtService, 4)}`);
    expect(res.status).toBe(200);
    expect(res.body.confirmedCount).toBe(3);
    expect(res.body.quorumReached).toBe(true);

    // GET match → confirmed
    const matchRes = await http
      .get(`/api/v1/matches/${matchId}`)
      .set('Authorization', `Bearer ${signJwt(jwtService, 1)}`);
    expect(matchRes.body.status).toBe('confirmed');
    expect(matchRes.body.confirmedAt).toBeTruthy();
  });

  // 2b — Confirmed match is immutable
  it('2b: confirmed match blocks PATCH, addPlayers, submitResult → 409', async () => {
    const matchId = await seedAwaitingMatch();

    // Reach quorum
    for (const userId of [1, 3, 4]) {
      await http
        .post(`/api/v1/matches/${matchId}/confirmations`)
        .set('Authorization', `Bearer ${signJwt(jwtService, userId)}`);
    }

    const token1 = signJwt(jwtService, 1);

    const patchRes = await http
      .patch(`/api/v1/matches/${matchId}`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ scoreA: 9, scoreB: 0 });
    expect(patchRes.status).toBe(409);
    expect(patchRes.body.error.code).toBe('MATCH_LOCKED');

    const playersRes = await http
      .post(`/api/v1/matches/${matchId}/players`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ players: [{ userId: 5, team: 'A', slot: 1 }] });
    expect(playersRes.status).toBe(409);

    const resultRes = await http
      .post(`/api/v1/matches/${matchId}/result`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ scoreA: 1, scoreB: 0 });
    expect(resultRes.status).toBe(409);
  });

  // 2c — Duplicate confirmation is idempotent
  it('2c: confirming twice does not increase confirmedCount', async () => {
    const matchId = await seedAwaitingMatch();
    const token1 = signJwt(jwtService, 1);

    const first = await http
      .post(`/api/v1/matches/${matchId}/confirmations`)
      .set('Authorization', `Bearer ${token1}`);
    expect(first.body.confirmedCount).toBe(1);

    const second = await http
      .post(`/api/v1/matches/${matchId}/confirmations`)
      .set('Authorization', `Bearer ${token1}`);
    expect(second.status).toBe(200);
    expect(second.body.confirmedCount).toBe(1);
  });

  // 2d — Non-player cannot confirm
  it('2d: user5 (not a player) confirms → 403 NOT_A_PLAYER', async () => {
    const matchId = await seedAwaitingMatch();

    const res = await http
      .post(`/api/v1/matches/${matchId}/confirmations`)
      .set('Authorization', `Bearer ${signJwt(jwtService, 5)}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_A_PLAYER');
  });

  // 2e — Confirmation state endpoint
  it('2e: GET /confirmations returns correct totals', async () => {
    const matchId = await seedAwaitingMatch();

    // 2 confirmations
    await http
      .post(`/api/v1/matches/${matchId}/confirmations`)
      .set('Authorization', `Bearer ${signJwt(jwtService, 1)}`);
    await http
      .post(`/api/v1/matches/${matchId}/confirmations`)
      .set('Authorization', `Bearer ${signJwt(jwtService, 3)}`);

    const res = await http
      .get(`/api/v1/matches/${matchId}/confirmations`)
      .set('Authorization', `Bearer ${signJwt(jwtService, 1)}`);

    expect(res.status).toBe(200);
    expect(res.body.totalPlayers).toBe(4);
    expect(res.body.confirmedCount).toBe(2);
    expect(res.body.quorumRequired).toBe(3);
    expect(res.body.quorumReached).toBe(false);
    expect(res.body.confirmations).toHaveLength(2);
    expect(res.body.confirmations[0]).toHaveProperty('userId');
    expect(res.body.confirmations[0]).toHaveProperty('confirmedAt');
  });
});
