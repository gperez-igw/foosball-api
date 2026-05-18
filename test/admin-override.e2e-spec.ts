/**
 * E2E Scenario 5 — Admin override of confirmed match result
 * test-criteria.md §SCENARIO 5
 */
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { buildTestApp, signJwt, TestApp } from './helpers/test-app.factory';

describe('Scenario 5 — Admin Override', () => {
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

  /** Create and confirm a 2v2 match; returns matchId */
  async function seedConfirmedMatch(): Promise<number> {
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

    // Reach quorum
    for (const userId of [1, 3, 4]) {
      await http
        .post(`/api/v1/matches/${matchId}/confirmations`)
        .set('Authorization', `Bearer ${signJwt(jwtService, userId)}`);
    }

    return matchId;
  }

  // 5a — Admin overrides score
  it('5a: admin overrides confirmed match score → 200 with auditLog', async () => {
    const matchId = await seedConfirmedMatch();
    const adminToken = signJwt(jwtService, 99, true);

    const res = await http
      .patch(`/api/v1/admin/matches/${matchId}/result`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scoreA: 6, scoreB: 3, reason: 'Score entry error' });

    expect(res.status).toBe(200);
    expect(res.body.match.scoreA).toBe(6);
    expect(res.body.match.scoreB).toBe(3);
    expect(res.body.match.status).toBe('confirmed');
    expect(res.body.auditLog.action).toBe('result_override');
    expect(res.body.auditLog.beforeData).toEqual({ scoreA: 5, scoreB: 3 });
    expect(res.body.auditLog.afterData).toEqual({ scoreA: 6, scoreB: 3 });
    expect(res.body.auditLog.reason).toBe('Score entry error');
    expect(res.body.auditLog.actorId).toBe(99);
  });

  // 5b — Audit log persisted
  it('5b: GET /admin/matches/:id/audit returns the override entry', async () => {
    const matchId = await seedConfirmedMatch();
    const adminToken = signJwt(jwtService, 99, true);

    await http
      .patch(`/api/v1/admin/matches/${matchId}/result`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scoreA: 6, scoreB: 3, reason: 'Score entry error' });

    const auditRes = await http
      .get(`/api/v1/admin/matches/${matchId}/audit`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data).toHaveLength(1);
    expect(auditRes.body.data[0].action).toBe('result_override');
    expect(auditRes.body.data[0].entityId).toBe(matchId);
  });

  // 5c — Non-admin cannot override
  it('5c: non-admin override → 403 FORBIDDEN_ADMIN_REQUIRED', async () => {
    const matchId = await seedConfirmedMatch();
    const nonAdminToken = signJwt(jwtService, 5, false);

    const res = await http
      .patch(`/api/v1/admin/matches/${matchId}/result`)
      .set('Authorization', `Bearer ${nonAdminToken}`)
      .send({ scoreA: 1, scoreB: 0 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ADMIN_REQUIRED');
  });

  // 5d — Admin cannot override non-confirmed match
  it('5d: admin override awaiting_confirmation match → 409 MATCH_NOT_CONFIRMED', async () => {
    const token = signJwt(jwtService, 1);
    const adminToken = signJwt(jwtService, 99, true);

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

    const res = await http
      .patch(`/api/v1/admin/matches/${matchId}/result`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scoreA: 1, scoreB: 0 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MATCH_NOT_CONFIRMED');
  });

  // 5e — Audit log is append-only (two overrides → two entries)
  it('5e: two admin overrides → two audit log entries', async () => {
    const matchId = await seedConfirmedMatch();
    const adminToken = signJwt(jwtService, 99, true);

    await http
      .patch(`/api/v1/admin/matches/${matchId}/result`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scoreA: 6, scoreB: 3, reason: 'First correction' });

    await http
      .patch(`/api/v1/admin/matches/${matchId}/result`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scoreA: 7, scoreB: 3, reason: 'Second correction' });

    const auditRes = await http
      .get(`/api/v1/admin/matches/${matchId}/audit`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data).toHaveLength(2);
  });
});
