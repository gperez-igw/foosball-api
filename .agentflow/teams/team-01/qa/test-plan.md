---
id: test-plan-001
type: test-plan
project: foosball-api
sprint: "01"
team: team-01
created_by: qa
created_at: 2026-05-18
status: ready
requires_decision: false
---

# Test Plan — foosball-api Sprint-01 MVP

## Coverage Target

Per test-criteria.md: >= 80% statement coverage on libs/matches, libs/leaderboard, libs/auth, libs/users.

## Test Framework

Jest 30 + ts-jest with `tsconfig.test.json` (CommonJS/node). Unit tests: `npm test`; e2e: `npm run test:e2e`; coverage: `npm run test:cov`. Verified in package.json and test/jest-e2e.json.

---

## E2E Test Cases

### Scenario 1 — Match Lifecycle (`test/match-lifecycle.e2e-spec.ts`)

| ID | Given/When/Then | Type |
|----|----------------|------|
| 1a | Auth user1 → POST /matches {2v2} → POST /players (4) → POST /result | e2e |
| 1b | Auth user → POST /matches {} → 201, matchType=2v2 | e2e |
| 1c | Auth user → POST /matches {matchType:"3v3"} → 400 | e2e |
| 1d | Match by user1 → user2 POST /players → 403 FORBIDDEN_NOT_CREATOR | e2e |
| 1e | Full 2v2 → add 5th player → 400 CAPACITY_EXCEEDED | e2e |
| 1f | 2v2 with 3 players → POST /result → 400 INSUFFICIENT_PLAYERS | e2e |
| 1g | No auth header → POST /matches → 401 | e2e |

### Scenario 2 — Confirmation Quorum (`test/match-confirmation.e2e-spec.ts`)

| ID | Given/When/Then | Type |
|----|----------------|------|
| 2a | 4-player awaiting_confirmation, quorum=3 → 3 sequential confirmations → confirmed, confirmedAt set | e2e |
| 2b | Confirmed match → PATCH score / addPlayers / submitResult → all 409 | e2e |
| 2c | user1 confirms twice → confirmedCount stays at 1 | e2e |
| 2d | user5 (non-player) confirms → 403 NOT_A_PLAYER | e2e |
| 2e | 2 confirmations → GET /confirmations → totalPlayers=4, confirmedCount=2, quorumRequired=3 | e2e |

### Scenario 3 — Match Lock (`test/match-lock.e2e-spec.ts`)

| ID | Given/When/Then | Type |
|----|----------------|------|
| 3a | awaiting_confirmation → PATCH score → 409 MATCH_LOCKED, details.status="awaiting_confirmation" | e2e |
| 3b | awaiting_confirmation → POST /players → 409 MATCH_LOCKED | e2e |
| 3c | awaiting_confirmation → POST /result → 409 | e2e |

### Scenario 4 — Confirmation Cancel (`test/match-confirmation-cancel.e2e-spec.ts`)

| ID | Given/When/Then | Type |
|----|----------------|------|
| 4a | 2 votes, creator → cancel → confirmedCount=0, status=playing, scores preserved → PATCH OK → resubmit awaiting_confirmation | e2e |
| 4b | Non-creator → POST /cancel → 403 FORBIDDEN_NOT_CREATOR | e2e |
| 4c | Confirmed match → creator cancel → 409 MATCH_ALREADY_CONFIRMED | e2e |
| 4d | After cancel (back to playing) → GET /confirmations → 409 MATCH_NOT_AWAITING_CONFIRMATION | e2e |

### Scenario 5 — Admin Override (`test/admin-override.e2e-spec.ts`)

| ID | Given/When/Then | Type |
|----|----------------|------|
| 5a | Confirmed match, admin token → PATCH /admin/matches/:id/result {scoreA:6} → 200, auditLog.action=result_override, beforeData/afterData correct | e2e |
| 5b | After 5a → GET /admin/matches/:id/audit → data[0].entityId=matchId | e2e |
| 5c | Confirmed match, non-admin → PATCH /admin result → 403 FORBIDDEN_ADMIN_REQUIRED | e2e |
| 5d | awaiting_confirmation, admin → PATCH /admin result → 409 MATCH_NOT_CONFIRMED | e2e |
| 5e | Two admin overrides → GET /audit → data.length=2 | e2e |

### Scenario 6 — Azure SSO (`test/auth-sso.e2e-spec.ts`)

| ID | Given/When/Then | Type |
|----|----------------|------|
| 6a | MSAL mock groups=[ADMIN_GROUP] → GET /auth/callback → 200, expiresIn=900, JWT is_admin=true, user.isAdmin=true, refreshToken.usedAt=null | e2e |
| 6b | MSAL mock groups=["other"] → callback → 200, is_admin=false | e2e |
| 6c | Seeded user, valid token → GET /auth/me → 200, {id, email, displayName, isAdmin} | e2e |
| 6d | T1 from callback → POST /refresh → T2; T1 again → 401 INVALID_REFRESH_TOKEN | e2e |
| 6e | Expired refresh token → POST /refresh → 401 INVALID_REFRESH_TOKEN | e2e |
| 6f | _claim_names.groups present, Graph returns [ADMIN_GROUP] → callback → is_admin=true | e2e |
| 6g | _claim_names.groups present, Graph 503 twice → callback → 503 AZURE_GRAPH_UNAVAILABLE | e2e |
| 6h | POST /logout {T1} → 204; POST /refresh {T1} → 401 | e2e |

### Scenario 7 — Leaderboard (`test/leaderboard.e2e-spec.ts`)

| ID | Given/When/Then | Type |
|----|----------------|------|
| 7a | Mock week data → GET /leaderboard/users?filter=week → user1.wins=2, X-Cache=MISS | e2e |
| 7b | Mock month data → GET filter=month → user1.wins=3 | e2e |
| 7c | Mock year data → GET filter=year → 4 entries, user3.wins=1 | e2e |
| 7d | Mock total data → GET filter=total → user3.wins=2 | e2e |
| 7e | Mock week pair data → GET /leaderboard/pairs?filter=week → (user1,user2) wins=2 | e2e |
| 7f | Mock total pair data → GET filter=total → rank1 wins=3, rank2 wins=2 | e2e |
| 7g | First GET=MISS populates cache → second GET → X-Cache=HIT, repo called once | e2e |
| 7h | Cache populated, store cleared → GET → X-Cache=MISS | e2e |
| 7i | GET filter=quarter → 400 | e2e |

---

## Unit Test Cases

### libs/auth/src/msal.strategy.spec.ts (14 tests)
Token validation, claims extraction (oid/email/displayName), is_admin from groups, Graph fallback, ServiceUnavailableException propagation, token pair expiresIn=900.

### libs/auth/src/azure-ad.service.spec.ts (3 tests — Scenarios 8a/8b)
Graph returns group array; retry once on 503, succeed; both 503 → ServiceUnavailableException.

### libs/auth/src/auth.service.spec.ts
handleCallback flow, upsertFromAzure called before token issuance.

### libs/auth/src/refresh-token.service.spec.ts
Issue, validate (valid/used/expired), single-use rotation.

### libs/users/src/user.service.spec.ts
upsert on login, is_admin sync, displayName update.

### libs/matches/src/services/match.service.spec.ts
Create match, addPlayers capacity/slot validation, submitResult, status transitions.

### libs/matches/src/services/confirmation.service.spec.ts
Vote record, quorum = floor(n/2)+1, cancel reset, idempotency.

### libs/matches/src/services/admin-override.service.spec.ts
Score override, audit log write, rollback on BullMQ failure.

### libs/leaderboard/src/leaderboard.service.spec.ts
getUserWins per filter, cache hit/miss/bypass, pair computation.

### libs/events/src/event-envelope.spec.ts
EventEnvelope shape, version field present.

### apps/worker/src/processors/match-confirmed.processor.spec.ts
Process job, version mismatch → DLQ, retry behavior.

### apps/worker/src/processors/leaderboard-invalidate.processor.spec.ts
Redis key deletion on invalidate event.

### apps/worker/src/processors/audit-log.processor.spec.ts
Write to DB, DLQ path on persistent failure.

### apps/producer/src/schedulers/leaderboard-cron.service.spec.ts
Cron trigger, publishes correct EventEnvelope.

### apps/api/src/admin/admin.controller.spec.ts
AdminController route coverage, guard integration.

### libs/events/src/queue-config.spec.ts
Queue configuration constants.
