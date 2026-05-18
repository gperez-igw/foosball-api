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

## Blockers

None. All tasks completed.

---

## Coverage Estimate (backend-api area)

- Endpoints: 100% (all 22 endpoints implemented; DLQ stubs replaced with real service)
- Entities: 100%
- Business Logic: 100% (all BullMQ events wired)
- Unit Tests: 100% (4/4 spec files)
- E2E Tests: 100% (6/6 spec files, all scenarios covered)

**Milestone estimate: 100% complete**
