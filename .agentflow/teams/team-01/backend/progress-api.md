---
id: progress-backend-api-001
type: progress
project: foosball-api
sprint: "01"
team: team-01
created_by: backend-api
created_at: 2026-05-18
status: milestone-ready
requires_decision: false
---

# Backend API — Sprint-01 Progress

## Status: milestone-ready

All 7 delta tasks completed. Build clean. All tests pass.

---

## Completed Tasks

### Task 1 — Fix POST /matches HTTP 201
- Added `@HttpCode(HttpStatus.CREATED)` to `MatchesController.createMatch()`
- Also added `@HttpCode(HttpStatus.OK)` to 4 other POST endpoints that return 200 per spec:
  `addPlayers`, `submitResult`, `confirmResult`, `cancelConfirmation`
- **Spec ref**: api.yaml `createMatch` (responses.201)

### Task 2 — BullMQ publishing: match domain services
- `MatchService.submitResult`: publishes `match.result_submitted` to `QUEUE_MATCHES`
- `ConfirmationService.confirm`: on quorum reached, publishes `match.confirmed` to `QUEUE_MATCHES` + `leaderboard-invalidate` to `QUEUE_LEADERBOARD`
- `ConfirmationService.cancel`: publishes `match.confirmation_cancelled` to `QUEUE_MATCHES`
- `MatchesModule`: registered `BullModule.registerQueue` for QUEUE_MATCHES, QUEUE_LEADERBOARD, QUEUE_AUDIT
- `AppModule`: registered `BullModule.forRootAsync` with Redis config from ConfigService
- **Spec ref**: api.yaml `submitResult`, `confirmResult`, `cancelConfirmation`; test-criteria.md §BullMQ EVENT CONTRACTS

### Task 3 — BullMQ publishing: AdminOverrideService
- `AdminOverrideService.overrideResult`: publishes `audit-log-write` to `QUEUE_AUDIT` and `leaderboard-invalidate` to `QUEUE_LEADERBOARD` **inside the DB transaction** — if publish fails, transaction rolls back
- Injected `QUEUE_AUDIT` and `QUEUE_LEADERBOARD` queues
- **Spec ref**: api.yaml `adminOverrideResult` (responses.500 AUDIT_LOG_WRITE_FAILED)

### Task 4 — Fix TS1272 isolatedModules errors
- `add-players.dto.ts`: changed `import { Team }` → `import type { Team }`
- `create-match.dto.ts`: changed `import { MatchType }` → `import type { MatchType }`
- `list-matches.dto.ts`: changed `import { MatchType, MatchStatus }` → `import type { MatchType, MatchStatus }`
- **Spec ref**: architecture.md §TypeScript configuration

### Task 5 — Wire DlqInspectorService into AdminController
- Imported `DlqInspectorService` and `DlqInspectorModule` from `@app/events`
- `AdminController.listDlqJobs`: calls `dlqInspectorService.listFailed(queue?)`
- `AdminController.retryDlqJob`: calls `dlqInspectorService.retryJob(queueName, jobId)` with 404 if job not found
- Added `DlqInspectorModule` to `AppModule` imports
- **Spec ref**: api.yaml `listDlqJobs`, `retryDlqJob`

### Task 6 — Unit tests (4 files)
- `libs/matches/src/services/match.service.spec.ts` — 20 tests: create, findById, update, addPlayers, submitResult, delete
- `libs/matches/src/services/confirmation.service.spec.ts` — 15 tests: calculateQuorum, getStatus, confirm (quorum reached/not/idempotent), cancel
- `libs/matches/src/services/admin-override.service.spec.ts` — 12 tests: overrideResult (happy/403/404/409/rollback), deleteMatch, getAuditLog
- `libs/leaderboard/src/leaderboard.service.spec.ts` — 15 tests: getUserLeaderboard (MISS/HIT/BYPASS/TTL/all-filters), getPairLeaderboard, invalidateCache

### Task 7 — E2E tests (6 files in test/)
- `test/match-lifecycle.e2e-spec.ts` — 7 scenarios (1a–1g)
- `test/match-confirmation.e2e-spec.ts` — 5 scenarios (2a–2e)
- `test/match-lock.e2e-spec.ts` — 3 scenarios (3a–3c)
- `test/match-confirmation-cancel.e2e-spec.ts` — 4 scenarios (4a–4d)
- `test/admin-override.e2e-spec.ts` — 5 scenarios (5a–5e)
- `test/leaderboard.e2e-spec.ts` — 9 scenarios (7a–7i)
- Shared factory: `test/helpers/test-app.factory.ts` — in-memory store, mock queues, mock Redis, JWT signing
- Fixed `test/jest-e2e.json` — added `.js` extension stripping in moduleNameMapper for nodenext imports

---

## Build & Test Results

```
npm run build:api    — CLEAN (0 errors)
tsc --noEmit         — CLEAN (0 errors, all 3 TS1272 DTO errors fixed)

Unit tests (npm test):
  Test Suites: 14 passed, 14 total
  Tests:       124 passed, 124 total
  (libs/matches: 47, libs/leaderboard: 15, libs/events: 2, backend-auth area: 60)

E2E tests (npm run test:e2e — my 6 test files):
  Tests: 33 passed, 33 total
  (match-lifecycle: 7, match-confirmation: 5, match-lock: 3,
   match-confirmation-cancel: 4, admin-override: 5, leaderboard: 9)
```

---

---

## Code Review Fixes (post-review, 2026-05-18)

Findings IMP-02, IMP-05, IMP-06 fixed.

### IMP-02 — apps/api/src/admin/admin.controller.ts
- `POST /admin/dlq/:jobId/retry`: `queue` query param is now **required**.
  Returns `400 QUEUE_REQUIRED` when omitted. `@ApiQuery({ required: true })` annotation updated.
  NIT-03 (catch `err: any`) fixed to `catch (err: unknown)` with `err instanceof Error` narrowing.
- New unit test file: `apps/api/src/admin/admin.controller.spec.ts` — 5 tests covering:
  missing queue → 400, empty queue → 400, valid queue → 200, job-not-found → 404, redis error re-throw.

### IMP-05 — libs/matches/src/services/admin-override.service.ts
- `overrideResult`: audit log now saved via `queryRunner.manager.save(AuditLogEntity, data)` inside
  the transaction (was `matchRepository.saveAuditLog()` on the default connection).
  If transaction rolls back (e.g. BullMQ failure), the audit log row is also rolled back.
- Updated `admin-override.service.spec.ts`:
  - Happy-path test asserts `qr.manager.save` called twice (match + audit log) and
    `repo.saveAuditLog` is **not** called.
  - Rollback test asserts `repo.saveAuditLog` is not called when queue publish fails.

### IMP-06 — libs/matches/src/services/confirmation.service.ts
- `confirm()` now wrapped in a DB transaction with `SELECT ... FOR UPDATE`
  (`pessimistic_write` lock on the match row) to prevent duplicate quorum events under concurrency.
  Flow: pre-checks → lock match row → idempotent confirmation save → quorum check → status update
  → commit → publish events exactly once.
  If match is already 'confirmed' by a concurrent request after lock acquisition, rolls back and
  returns current state without publishing events.
- Added `MatchEntity` static import (was missing).
- `getDataSource` added to `mockMatchRepository()` in `confirmation.service.spec.ts`.
- Updated `describe('confirm')` block with 7 tests covering:
  transaction opened/committed, idempotency, quorum transition (manager.save used not repo.save),
  concurrent-lock idempotency (confirmedInTx path), NOT_A_PLAYER, unknown match, wrong status.

### e2e test factory update — test/helpers/test-app.factory.ts
- `getDataSource` QueryRunner manager mock extended with `findOne`, `find`, `create`, and
  updated `save` (two-arg form for audit log; `MatchConfirmationEntity` form updates in-memory store).
  All 42 e2e tests restored to green.

### Build & Test Results (post-fix)
```
npm run build:api    — CLEAN (0 errors)

Unit tests (npx jest):
  Test Suites: 16 passed, 16 total
  Tests:       135 passed, 135 total

E2E tests (npm run test:e2e):
  Test Suites: 8 passed, 8 total
  Tests:       42 passed, 42 total
```

---

---

## Coverage Round (2026-05-18 — QA gate fix)

### Before (baseline from QA run)
| Lib | Statements |
|-----|-----------|
| libs/matches | ~55% |
| libs/leaderboard | ~53% |

### After (new tests added)
| Lib | Statements | Branches | Functions | Lines |
|-----|-----------|----------|-----------|-------|
| libs/matches | **86.66%** | 83.33% | 66.12% | 90.07% |
| libs/leaderboard | **84.12%** | 75.00% | 75.00% | 87.96% |

Both libs exceed the 80% statement threshold.

### New test files added
- `libs/matches/src/repositories/match.repository.spec.ts` — 32 tests
  - Covers: `findById`, `save`, `create`, `delete`, `findPaginated` (all filter branches + cursor decoding + hasMore logic), `findPlayers`, `findPlayer`, `savePlayers`, `findConfirmations`, `findConfirmation`, `saveConfirmation`, `deleteAllConfirmations`, `saveAuditLog`, `findAuditLogs`, `getDataSource`
- `libs/matches/src/dto/dto.spec.ts` — 26 tests
  - Covers all 6 DTO classes: `CreateMatchDto`, `UpdateMatchDto`, `SubmitResultDto`, `AdminOverrideResultDto`, `PlayerDto`, `AddPlayersDto`, `ListMatchesDto`
- `libs/leaderboard/src/leaderboard.repository.spec.ts` — 17 tests
  - Covers: `getUserWins` (total/week/month/year date logic, empty result, numeric coercion), `getPairWins` (same branches)
- `libs/leaderboard/src/dto/leaderboard-query.dto.spec.ts` — 7 tests

### Full suite results
```
npm test:
  Test Suites: 24 passed, 24 total
  Tests:       261 passed, 261 total

npm run test:e2e:
  Test Suites: 8 passed, 8 total
  Tests:       42 passed, 42 total

npm run build:api: CLEAN
```

---

---

## Controller Unit Tests Round (2026-05-18 — QA coverage gate fix, 2nd pass)

### Problem
Overall "All files" statement coverage was 78.59%, below the 80% DoD.
`apps/api/src/{matches,leaderboard,health,filters}` had 0% unit coverage (exercised only by e2e).

### New test files added (apps/api/src area — write-area exclusive)

- `apps/api/src/filters/http-exception.filter.spec.ts` — 5 tests
  - Non-HttpException → 500 INTERNAL_ERROR envelope
  - HttpException with object response (code+message+details) → correct status + envelope
  - HttpException with object response missing code → HTTP_ERROR
  - HttpException with string response → HTTP_ERROR
  - 401 HttpException → correct code+message forwarded

- `apps/api/src/health/health.controller.spec.ts` — 3 tests
  - Returns `{ status: 'ok' }`
  - Returns valid ISO timestamp
  - Timestamp is close to now

- `apps/api/src/matches/matches.controller.spec.ts` — 9 tests (one per route method)
  - createMatch — delegates create(userId, dto)
  - listMatches — delegates list(query)
  - getMatch — delegates findById(matchId)
  - updateMatch — delegates update(matchId, userId, dto)
  - deleteMatch — delegates delete(matchId, userId, is_admin)
  - addPlayers — delegates addPlayers(matchId, userId, dto)
  - submitResult — delegates submitResult(matchId, userId, dto)
  - getConfirmationStatus — delegates getStatus(matchId)
  - confirmResult — delegates confirm(matchId, userId)
  - cancelConfirmation — delegates cancel(matchId, userId)

- `apps/api/src/leaderboard/leaderboard.controller.spec.ts` — 7 tests
  - getLeaderboardUsers: defaults filter=total limit=20, passes custom filter+limit,
    sets X-Cache BYPASS header, strips cacheStatus from body
  - getLeaderboardPairs: defaults, passes custom filter+limit, strips cacheStatus from body

### Coverage after new tests

| Area | Statements | Branches | Functions | Lines |
|------|-----------|----------|-----------|-------|
| apps/api/src/filters | **100%** | 83.33% | 100% | 100% |
| apps/api/src/health | **100%** | 100% | 100% | 100% |
| apps/api/src/leaderboard | **100%** | 85% | 100% | 100% |
| apps/api/src/matches | **100%** | 75% | 100% | 100% |
| **All files** | **92.48%** | 78.66% | 87.16% | 92.08% |

Overall statement coverage: **92.48%** (was 78.59%) — exceeds 80% DoD.

### Full suite results
```
npm run test:cov (unit):
  Test Suites: 31 passed, 31 total
  Tests:       320 passed, 320 total

npm run test:e2e:
  Test Suites: 8 passed, 8 total
  Tests:       42 passed, 42 total

npm run build:api: CLEAN
```

---

## Blockers

None. All tasks completed.

---

## Coverage Estimate (backend-api area)

- Endpoints: 100% (all 22 endpoints implemented; DLQ stubs replaced with real service)
- Entities: 100%
- Business Logic: 100% (all BullMQ events wired)
- Unit Tests: 100% (all spec files, including all controllers and exception filter)
- E2E Tests: 100% (6/6 spec files, all scenarios covered)

**Milestone estimate: 100% complete**
