/**
 * E2E Scenario 4 — Creator cancels confirmation → quorum reset to 0
 * test-criteria.md §SCENARIO 4
 */
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { buildTestApp, signJwt, TestApp } from './helpers/test-app.factory';

describe('Scenario 4 — Confirmation Cancel', () => {
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

    // Add 2 confirmations
    await http
      .post(`/api/v1/matches/${matchId}/confirmations`)
      .set('Authorization', `Bearer ${signJwt(jwtService, 1)}`);
    await http
      .post(`/api/v1/matches/${matchId}/confirmations`)
      .set('Authorization', `Bearer ${signJwt(jwtService, 3)}`);

    return { matchId, token };
  }

  // 4a — Cancel → reset → edit → resubmit
  it('4a: cancel resets quorum, allows edit and resubmit', async () => {
    const { matchId, token } = await seedAwaitingMatch();

    // Cancel
    const cancelRes = await http
      .post(`/api/v1/matches/${matchId}/confirmations/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.confirmedCount).toBe(0);
    expect(cancelRes.body.quorumReached).toBe(false);
    expect(cancelRes.body.confirmations).toEqual([]);

    // Match back to playing
    const matchRes = await http
      .get(`/api/v1/matches/${matchId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(matchRes.body.status).toBe('playing');

    // Score still present
    expect(matchRes.body.scoreA).toBe(5);
    expect(matchRes.body.scoreB).toBe(3);

    // Edit scores
    const patchRes = await http
      .patch(`/api/v1/matches/${matchId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ scoreA: 7, scoreB: 2 });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.scoreA).toBe(7);
    expect(patchRes.body.status).toBe('playing');

    // Resubmit result
    const resubmitRes = await http
      .post(`/api/v1/matches/${matchId}/result`)
      .set('Authorization', `Bearer ${token}`)
      .send({ scoreA: 7, scoreB: 2 });
    expect(resubmitRes.status).toBe(200);
    expect(resubmitRes.body.status).toBe('awaiting_confirmation');
  });

  // 4b — Non-creator cannot cancel
  it('4b: non-creator cancel → 403 FORBIDDEN_NOT_CREATOR', async () => {
    const { matchId } = await seedAwaitingMatch();

    const res = await http
      .post(`/api/v1/matches/${matchId}/confirmations/cancel`)
      .set('Authorization', `Bearer ${signJwt(jwtService, 2)}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_NOT_CREATOR');
  });

  // 4c — Cannot cancel a confirmed match
  it('4c: cancel confirmed match → 409 MATCH_ALREADY_CONFIRMED', async () => {
    const { matchId, token } = await seedAwaitingMatch();

    // Reach quorum first
    await http
      .post(`/api/v1/matches/${matchId}/confirmations`)
      .set('Authorization', `Bearer ${signJwt(jwtService, 4)}`);

    const res = await http
      .post(`/api/v1/matches/${matchId}/confirmations/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MATCH_ALREADY_CONFIRMED');
  });

  // 4d — Confirmations endpoint returns 409 after cancel (match back to playing)
  it('4d: GET /confirmations on playing match → 409 MATCH_NOT_AWAITING_CONFIRMATION', async () => {
    const { matchId, token } = await seedAwaitingMatch();

    await http
      .post(`/api/v1/matches/${matchId}/confirmations/cancel`)
      .set('Authorization', `Bearer ${token}`);

    const res = await http
      .get(`/api/v1/matches/${matchId}/confirmations`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MATCH_NOT_AWAITING_CONFIRMATION');
  });
});
