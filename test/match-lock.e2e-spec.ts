/**
 * E2E Scenario 3 — Modification blocked during confirmation phase
 * test-criteria.md §SCENARIO 3
 */
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { buildTestApp, signJwt, TestApp } from './helpers/test-app.factory';

describe('Scenario 3 — Match Lock During Awaiting Confirmation', () => {
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

  /** Create match in awaiting_confirmation */
  async function seedAwaitingMatch(): Promise<{ matchId: number; token: string }> {
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

    return { matchId, token };
  }

  // 3a — Score update blocked
  it('3a: PATCH score when awaiting_confirmation → 409 MATCH_LOCKED', async () => {
    const { matchId, token } = await seedAwaitingMatch();

    const res = await http
      .patch(`/api/v1/matches/${matchId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ scoreA: 9, scoreB: 0 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MATCH_LOCKED');
    expect(res.body.error.details.status).toBe('awaiting_confirmation');
  });

  // 3b — Player addition blocked
  it('3b: addPlayers when awaiting_confirmation → 409 MATCH_LOCKED', async () => {
    const { matchId, token } = await seedAwaitingMatch();

    const res = await http
      .post(`/api/v1/matches/${matchId}/players`)
      .set('Authorization', `Bearer ${token}`)
      .send({ players: [{ userId: 5, team: 'A', slot: 1 }] });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MATCH_LOCKED');
  });

  // 3c — Result resubmission blocked
  it('3c: submitResult when awaiting_confirmation → 409', async () => {
    const { matchId, token } = await seedAwaitingMatch();

    const res = await http
      .post(`/api/v1/matches/${matchId}/result`)
      .set('Authorization', `Bearer ${token}`)
      .send({ scoreA: 1, scoreB: 0 });

    expect(res.status).toBe(409);
  });
});
