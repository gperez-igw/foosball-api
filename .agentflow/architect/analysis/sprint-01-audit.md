---
id: analysis-sprint-01-audit
type: analysis
project: foosball-api
sprint: "01"
created_by: architect
created_at: 2026-05-18
status: draft
requires_decision: false
---

# Sprint-01 Code vs Spec Audit

## Purpose

Audit of the existing backend source code in `apps/` and `libs/` against the
approved sprint-01 specs (api.yaml, schema.sql, test-criteria.md, architecture.md).
Produced before re-spawning implementers to prevent duplication of finished work.

---

## Build Status

**Cannot build or run tests in the current environment.**

The devcontainer node_modules is incomplete: critical packages are missing or
contain only typings/fixtures directories without actual JS files.
Confirmed missing:
- `@nestjs/config` (entirely absent from node_modules/@nestjs/)
- `commander` (only `typings/` directory present — no JS)
- `import-local` (only `fixtures/` directory present — no JS)

A full `npm install` is required before any `nest build` or `jest` invocation
will succeed. TypeScript type-check (`tsc --noEmit`) was used as a proxy for
structural correctness; it surfaces 9 errors — see Section 6.

---

## Section 1 — backend-api Area

Ownership: `apps/api/`, `libs/matches/`, `libs/leaderboard/`

### 1.1 Endpoints (api.yaml vs controllers)

| Endpoint | Spec ref | Status | Notes |
|----------|----------|--------|-------|
| GET /health | healthCheck | **complete** | Public decorator applied; returns {status,timestamp} |
| GET /auth/login | authLogin | n/a (backend-auth) | Correctly in apps/auth/auth.controller.ts |
| GET /auth/callback | authCallback | n/a (backend-auth) | Correctly in apps/auth |
| POST /auth/refresh | authRefresh | n/a (backend-auth) | Correctly in apps/auth |
| POST /auth/logout | authLogout | n/a (backend-auth) | Correctly in apps/auth |
| GET /auth/me | authMe | n/a (backend-auth) | Correctly in apps/auth |
| GET /users/me | getMyProfile | n/a (backend-auth) | Correctly in apps/auth/users.controller.ts |
| PATCH /users/me | updateMyProfile | n/a (backend-auth) | Correctly in apps/auth/users.controller.ts |
| POST /matches | createMatch | **complete** | 201 not enforced (no @HttpCode decorator); returns 200 |
| GET /matches | listMatches | **complete** | Cursor pagination implemented |
| GET /matches/:id | getMatch | **complete** | 404 with correct error code |
| PATCH /matches/:id | updateMatch | **complete** | 409 MATCH_LOCKED enforced; 403 FORBIDDEN_NOT_CREATOR enforced |
| DELETE /matches/:id | deleteMatch | **complete** | Admin-only via RolesGuard; 403 correct |
| POST /matches/:id/players | addPlayers | **complete** | Capacity, slot conflict, 403 enforced |
| POST /matches/:id/result | submitResult | **complete** | Transitions to awaiting_confirmation; player count check |
| GET /matches/:id/confirmations | getConfirmationStatus | **complete** | 409 if not in awaiting_confirmation |
| POST /matches/:id/confirmations | confirmResult | **complete** | Quorum logic correct; idempotent |
| POST /matches/:id/confirmations/cancel | cancelConfirmation | **complete** | Creator-only; 409 if confirmed |
| GET /leaderboard/users | getLeaderboardUsers | **complete** | X-Cache header set; TTL correct |
| GET /leaderboard/pairs | getLeaderboardPairs | **complete** | Pair query implemented; X-Cache set |
| PATCH /admin/matches/:id/result | adminOverrideResult | **complete** | Transaction, audit log, 409 MATCH_NOT_CONFIRMED |
| DELETE /admin/matches/:id | adminDeleteMatch | **complete** | Audit log for confirmed matches |
| GET /admin/matches/:id/audit | getMatchAuditLog | **complete** | Returns {data:[]} wrapper |
| GET /admin/dlq | listDlqJobs | **stub** | Returns {data:[]} hardcoded; no BullMQ DLQ query wired |
| POST /admin/dlq/:jobId/retry | retryDlqJob | **stub** | Returns {jobId, status:'requeued'} hardcoded |

**One spec violation on createMatch:** POST /matches should return HTTP 201 (spec says 201) but controller uses default 200. Needs `@HttpCode(HttpStatus.CREATED)` decorator.

### 1.2 Schema — TypeORM Entities vs schema.sql

| Table | schema.sql | Entity | Status | Notes |
|-------|------------|--------|--------|-------|
| matches | 10 columns, 4 indexes | MatchEntity | **complete** | All columns, indexes, enum values match |
| match_players | 5 columns, PK + 2 indexes | MatchPlayerEntity | **complete** | PK (match_id, user_id); slot CHECK not in entity (app-layer enforced) |
| match_confirmations | 3 columns | MatchConfirmationEntity | **complete** | PK composite correct; FK cascades correct |
| audit_logs | 9 columns, 3 indexes | AuditLogEntity | **complete** | No FK to matches (by spec design — soft ref) |

### 1.3 Business Rules

| Rule | Spec ref | Status | Notes |
|------|----------|--------|-------|
| quorum = floor(n/2)+1 | test-criteria §2 | **complete** | `Math.floor(totalPlayers / 2) + 1` in ConfirmationService |
| draw = 0 wins (score_a == score_b excluded) | schema.sql §Leaderboard notes | **complete** | `score_a != score_b` filter in LeaderboardRepository SQL |
| Immutability post-confirmation (PATCH/players/result blocked) | spec §MATCH_LOCKED | **complete** | All three mutation paths check awaiting_confirmation or confirmed status |
| Cancel confirmation resets quorum to 0 | api.yaml confirmations/cancel | **complete** | deleteAllConfirmations + status → playing |
| Admin override writes audit log in transaction | api.yaml adminOverrideResult | **complete** | QueryRunner transaction with rollback on error |
| Admin override fires BullMQ events | api.yaml adminOverrideResult | **MISSING** | No queue injection in AdminOverrideService |
| submitResult fires match.result_submitted event | api.yaml submitResult | **MISSING** | No queue injection in MatchService |
| confirmResult fires match.confirmed + leaderboard-invalidate events | api.yaml confirmResult | **MISSING** | No queue injection in ConfirmationService |
| cancelConfirmation fires match.confirmation_cancelled event | api.yaml cancelConfirmation | **MISSING** | No queue injection in ConfirmationService |
| Leaderboard Redis fallback (BYPASS) on Redis error | api.yaml leaderboard | **complete** | try/catch in LeaderboardService.getUserLeaderboard |
| Cache invalidation via worker | test-criteria §7h | **partial** | Worker process deletes keys; but backend-api never publishes the leaderboard-invalidate event on confirm |

### 1.4 Tests — backend-api

| Spec target | test-criteria.md | Status | Notes |
|-------------|-----------------|--------|-------|
| libs/matches/src/services/match.service.spec.ts | §Unit tests backend-api | **MISSING** | File does not exist |
| libs/matches/src/services/confirmation.service.spec.ts | §Unit tests backend-api | **MISSING** | File does not exist |
| libs/matches/src/services/admin-override.service.spec.ts | §Unit tests backend-api | **MISSING** | File does not exist |
| libs/leaderboard/src/leaderboard.service.spec.ts | §Unit tests backend-api | **MISSING** | File does not exist |
| test/match-lifecycle.e2e-spec.ts | Scenario 1 | **MISSING** | Only placeholder e2e file exists |
| test/match-confirmation.e2e-spec.ts | Scenario 2 | **MISSING** | Not created |
| test/match-lock.e2e-spec.ts | Scenario 3 | **MISSING** | Not created |
| test/match-confirmation-cancel.e2e-spec.ts | Scenario 4 | **MISSING** | Not created |
| test/admin-override.e2e-spec.ts | Scenario 5 | **MISSING** | Not created |
| test/leaderboard.e2e-spec.ts | Scenario 7 | **MISSING** | Not created |

---

## Section 2 — backend-auth Area

Ownership: `apps/auth/`, `libs/auth/`, `libs/users/`

### 2.1 Endpoints

| Endpoint | Spec ref | Status | Notes |
|----------|----------|--------|-------|
| GET /auth/login | authLogin | **complete** | Throttle 10/min; redirect to Azure |
| GET /auth/callback | authCallback | **complete** | Groups claim + Graph fallback implemented |
| POST /auth/refresh | authRefresh | **complete** | Single-use rotation; Throttle 10/min |
| POST /auth/logout | authLogout | **complete** | used_at = NOW() via RefreshTokenService.invalidate |
| GET /auth/me | authMe | **complete** | Returns UserProfile from DB |
| GET /users/me | getMyProfile | **complete** | JWT-gated |
| PATCH /users/me | updateMyProfile | **partial** | Missing length validation for displayName=1 char case (empty string check exists but minLength=1 spec not enforced against non-empty whitespace-only strings after trim — minor) |

**Spec deviation:** `apps/auth/app.module.ts` uses ThrottlerGuard as APP_GUARD instead of JwtAuthGuard. This means JWT validation is not applied globally in the auth app. The AuthController applies JwtAuthGuard at class level for endpoints that need it, but using ThrottlerGuard globally means an unauthenticated request to a non-public route will get a throttler response, not a 401. This is a bug — should use JwtAuthGuard as APP_GUARD globally with @Public() exemptions, consistent with apps/api.

### 2.2 Schema — TypeORM Entities vs schema.sql

| Table | schema.sql | Entity | Status | Notes |
|-------|------------|--------|--------|-------|
| users | 7 columns, 3 indexes | UserEntity | **complete** | All columns match; @Index decorators correct |
| refresh_tokens | 7 columns, 3 indexes | RefreshTokenEntity | **complete** | tokenHash, expires_at, used_at, replaced_by all present; FK cascades correct |

### 2.3 Business Rules

| Rule | Spec ref | Status | Notes |
|------|----------|--------|-------|
| SHA-256 hash stored (not raw token) | schema.sql refresh_tokens comment | **complete** | crypto.createHash('sha256') in RefreshTokenService |
| Single-use token rotation | api.yaml authRefresh | **complete** | old token used_at=NOW(); new token issued; replaced_by set |
| 24h TTL on refresh token | api.yaml authRefresh | **complete** | refreshTtlMs = 24h in TokenService |
| 15min JWT expiry | api.yaml authLogin | **complete** | expiresIn: '15m' in JwtModule config; expiresIn: 900 in TokenPair |
| is_admin sync from Azure AD groups | api.yaml authCallback | **complete** | adminGroupId compared against groups claim |
| Graph API fallback when _claim_names.groups present | api.yaml authCallback | **complete** | claimNames?.groups triggers getGroupsFromGraph |
| Graph API retry once then AZURE_GRAPH_UNAVAILABLE | test-criteria §8b | **complete** | maxRetries=2 loop in AzureAdService |
| User upsert on every login | api.yaml authCallback | **complete** | userRepository.upsert via UserService.upsertFromAzure |
| displayName min 1 / max 255 | api.yaml updateMyProfile | **complete** | UserService.updateDisplayName validates after trim |

### 2.4 Tests — backend-auth

| Spec target | test-criteria.md | Status | Notes |
|-------------|-----------------|--------|-------|
| libs/auth/src/auth.service.spec.ts | §Unit tests backend-auth | **complete** | 5 scenarios: admin group, non-admin, Graph fallback, Graph unavailable, bad code |
| libs/auth/src/azure-ad.service.spec.ts | §8a/8b (GraphGroupsService) | **complete** | 3 scenarios: success, retry+succeed, both fail |
| libs/auth/src/refresh-token.service.spec.ts | §Unit tests backend-auth | **complete** | issue, validate (valid/used/expired), rotate, invalidate |
| libs/users/src/user.service.spec.ts | §Unit tests backend-auth | **complete** | upsert, findById, updateDisplayName |
| libs/auth/src/msal.strategy.spec.ts | §Unit tests backend-auth | **MISSING** | No file exists (strategy logic is in AzureAdService.spec.ts — partial coverage) |
| test/auth-sso.e2e-spec.ts | Scenario 6 (6a-6h) | **MISSING** | Not created |

**Note:** The spec lists `msal.strategy.spec.ts` but the implementation chose `AzureAdService` (not `MsalStrategy`), so the Graph fallback scenarios are covered there. A formal MSAL strategy spec file is still absent per test-criteria naming.

---

## Section 3 — backend-jobs Area

Ownership: `apps/worker/`, `apps/producer/`, `libs/events/`

### 3.1 Event Types vs spec contracts

| Event type | test-criteria BullMQ contracts | Status | Notes |
|-----------|-------------------------------|--------|-------|
| EventEnvelope<T> interface | §BullMQ EVENT CONTRACTS | **complete** | eventType, version, occurredAt, payload fields |
| MatchResultSubmittedPayload | match.result_submitted | **complete** | matchId, matchType, scoreA, scoreB |
| MatchConfirmedPayload | match.confirmed | **complete** | matchId, confirmedAt, winnerTeam — also includes scoreA/scoreB (superset, not a violation) |
| MatchCancelledPayload | match.confirmation_cancelled | **partial** | Payload file exists with matchId+cancelledBy; spec says `match.confirmation_cancelled` event type, but this is the type definition — naming is acceptable |
| LeaderboardInvalidatePayload | leaderboard-invalidate | **complete** | reason, affectedFilters |
| AuditLogPayload | audit-log-write | **complete** | entityType, entityId, action, actorId, beforeData, afterData, reason |
| QUEUE_MATCHES, QUEUE_LEADERBOARD, QUEUE_AUDIT constants | queue-names | **complete** | Single source of truth |
| defaultJobOptions | queue-config | **complete** | attempts=5, exponential backoff, removeOnFail=false (DLQ via BullMQ default) |

### 3.2 Worker Consumers

| Processor | Spec requirement | Status | Notes |
|-----------|-----------------|--------|-------|
| MatchConfirmedProcessor | consume QUEUE_MATCHES, check version, DLQ on mismatch | **complete** | Version check; onFailed DLQ logging |
| LeaderboardInvalidateProcessor | consume QUEUE_LEADERBOARD, delete Redis keys, DLQ | **complete** | Deletes all 8 keys (2 scopes x 4 filters) |
| AuditLogProcessor | consume QUEUE_AUDIT, write to DB, DLQ | **partial** | Logs the payload but does NOT actually write to audit_logs DB table. The spec says the worker writes the record — currently just a logger.log call |

### 3.3 Producer / Cron

| Component | Spec requirement | Status | Notes |
|-----------|-----------------|--------|-------|
| LeaderboardCronService @Cron(EVERY_HOUR) | producer cron publishes leaderboard-invalidate | **complete** | Stable hourly jobId for dedup; all 4 filters |
| Event publishing from match domain | backend-api publishes on submitResult, confirm, cancel, adminOverride | **MISSING** | No BullMQ queue injection in apps/api AppModule or libs/matches services |

**Critical gap:** The matches module (`MatchesModule`, `ConfirmationService`, `MatchService`, `AdminOverrideService`) has no `@InjectQueue` dependency and never calls `queue.add()`. The spec mandates:
- `match.result_submitted` on POST /matches/:id/result
- `match.confirmed` on quorum reached
- `match.confirmation_cancelled` on POST /confirmations/cancel
- `audit-log-write` and `leaderboard-invalidate` on PATCH /admin/matches/:id/result

None of these events are published.

### 3.4 DLQ Admin Endpoints

| Endpoint | Spec | Status |
|----------|------|--------|
| GET /admin/dlq | listDlqJobs | **stub** (returns []) |
| POST /admin/dlq/:jobId/retry | retryDlqJob | **stub** (returns hardcoded requeued) |

These are in AdminController (apps/api) — backend-jobs needs to provide a service for DLQ inspection that the controller can call. No DLQ inspection service exists in apps/worker or apps/producer.

### 3.5 Tests — backend-jobs

| Spec target | test-criteria.md | Status | Notes |
|-------------|-----------------|--------|-------|
| libs/events/src/event-envelope.spec.ts | §Unit tests backend-jobs | **complete** | 2 basic shape tests |
| apps/worker/src/processors/match-confirmed.processor.spec.ts | §Unit tests backend-jobs | **complete** | process (valid), version mismatch, DLQ exhausted, non-DLQ |
| apps/worker/src/processors/leaderboard-invalidate.processor.spec.ts | §Unit tests backend-jobs | **complete** | Redis key deletion, version mismatch, DLQ logging |
| apps/producer/src/schedulers/leaderboard-cron.service.spec.ts | §Unit tests backend-jobs | **complete** | Event published, all filters, stable jobId |
| AuditLogProcessor spec | §match-confirmed.processor (implied) | **MISSING** | No spec file for AuditLogProcessor |

---

## Section 4 — Shared Infrastructure

### 4.1 TypeORM Migrations

All 6 migration files exist and match schema.sql exactly:
- `001-AddUsersTable.ts` — users table, indexes
- `002-AddRefreshTokensTable.ts` — refresh_tokens, FK to users
- `003-AddMatchesTable.ts` — matches, FK to users (ON DELETE SET NULL)
- `004-AddMatchPlayersTable.ts` — match_players, composite PK, slot constraint
- `005-AddMatchConfirmationsTable.ts` — match_confirmations
- `006-AddAuditLogsTable.ts` — audit_logs, soft ref (no FK to matches)

**One gap:** `libs/database/src/data-source.ts` only includes migrations 001+002. It does NOT include 003–006. This means `npm run migration:run` (which uses this data-source) will not create the match domain tables. The AppDataSource needs to reference all 6 migrations. **Apps/api AppModule uses `migrationsRun:true` with `migrations:['dist/migrations/*.js']`** which should pick up all compiled migration files — so production startup is fine, but the CLI `migration:run` command is broken.

### 4.2 docker-compose

**Complete.** MySQL 8 + Redis 7-alpine with health checks. Passwords via env vars. Volumes named. Ports configurable.

### 4.3 Configuration (.env.example)

**Complete.** All required env vars present: DB, Redis, JWT, Azure AD, CORS.

### 4.4 Monorepo Config

- `nest-cli.json`: all 4 apps + 7 libs registered. Includes `libs/jobs` (an extra lib not in spec, currently empty — no impact).
- `package.json`: all required runtime dependencies present. Jest config with moduleNameMapper for all path aliases. `tsconfig.test.json` correctly sets `module: CommonJS, moduleResolution: node` (per test-criteria §JEST + MODULE RESOLUTION VALIDATION).
- `tsconfig.build.json`: exists.

### 4.5 File Ownership Violations

| File | Owner per teams.md | Actual author | Verdict |
|------|-------------------|---------------|---------|
| apps/api/src/admin/admin.controller.ts | backend-api | backend-api | OK |
| libs/matches/src/entities/audit-log.entity.ts | backend-api | backend-api | OK |
| All backend-jobs files | backend-jobs | backend-jobs | OK |
| libs/auth/src/ | backend-auth | backend-auth | OK |
| libs/users/src/ | backend-auth | backend-auth | OK |

No ownership violations detected.

### 4.6 TypeScript Type Errors (tsc --noEmit)

Running `tsc --noEmit -p apps/api/tsconfig.app.json` yields 9 errors:

1. **TS2307 — Cannot find module '@nestjs/config'** (5 occurrences across apps/api, libs/auth): `@nestjs/config` is not in `package.json` dependencies and not installed. This is a missing dependency that must be added.
2. **TS1272 — emitDecoratorMetadata + isolatedModules incompatibility** (4 occurrences in DTO files): `add-players.dto.ts`, `create-match.dto.ts`, `list-matches.dto.ts` use `@IsEnum()` and `@ValidateNested()` on properties whose types are imported values (not type-only imports). Requires adding `import type` or restructuring the imports. This is a compile-time error that will prevent build.

---

## Section 5 — Cross-Area Consistency

| Check | Status | Notes |
|-------|--------|-------|
| JwtPayload interface used consistently | **partial** | `apps/auth` imports from `@app/auth/token.service.js` (direct path); `apps/api` imports from `@app/auth` (re-exported). Minor inconsistency but functional. |
| apps/auth uses ThrottlerGuard globally instead of JwtAuthGuard | **violation** | Should mirror apps/api pattern: JwtAuthGuard as APP_GUARD, @Public() on public routes |
| LeaderboardInvalidateProcessor uses hardcoded Redis host | **partial** | Uses process.env directly via `new Redis(...)` in constructor (not injected via NestJS DI). Works at runtime but untestable without mocking — ioredis-mock workaround is in the test. Acceptable for MVP. |
| AuditLogProcessor does not persist to DB | **spec violation** | Spec says worker writes to audit_logs; processor only logs. The spec also says adminOverride publishes audit-log-write event but the service doesn't publish it. This creates a double gap. |
| draw = 0 wins correctly handled | **complete** | SQL filters `score_a != score_b`; winnerTeam payload uses 'A' | 'B' | 'draw' enum |
| BullMQ events never published from match domain | **critical missing** | All 4 event publish points are absent from libs/matches services |

---

## Section 6 — Remaining Work Delta

### backend-api — Remaining Tasks

1. **Fix POST /matches HTTP 201**: Add `@HttpCode(HttpStatus.CREATED)` to `MatchesController.createMatch()`.

2. **Wire BullMQ publishing into MatchService**:
   - Inject `@InjectQueue(QUEUE_MATCHES)` for `match.result_submitted` (in `submitResult`)
   - Inject `@InjectQueue(QUEUE_MATCHES)` and `@InjectQueue(QUEUE_LEADERBOARD)` for `match.confirmed` and `leaderboard-invalidate` (in `ConfirmationService.confirm`)
   - Inject `@InjectQueue(QUEUE_MATCHES)` for `match.confirmation_cancelled` (in `ConfirmationService.cancel`)
   - Register BullMQ module in `MatchesModule` and `apps/api/AppModule`

3. **Wire BullMQ publishing into AdminOverrideService**:
   - On `overrideResult`: publish `audit-log-write` to QUEUE_AUDIT and `leaderboard-invalidate` to QUEUE_LEADERBOARD
   - The spec says if this event fails, operation is rolled back — integrate event publish into the transaction (if BullMQ publish fails, rollback DB changes)

4. **Fix TS1272 errors in DTOs**: In `add-players.dto.ts`, `create-match.dto.ts`, `list-matches.dto.ts` — change value imports of TypeORM/entity types to `import type` or restructure to avoid decorator metadata conflict with `isolatedModules`.

5. **Implement DLQ inspection service**: Create a `DlqService` (owned by backend-jobs, consumed by AdminController) that calls BullMQ `queue.getFailed()` to list DLQ jobs and `queue.getJob(id).retry()` to re-queue. Wire into `AdminController.listDlqJobs` and `AdminController.retryDlqJob`.

6. **Write missing unit tests**:
   - `libs/matches/src/services/match.service.spec.ts`
   - `libs/matches/src/services/confirmation.service.spec.ts`
   - `libs/matches/src/services/admin-override.service.spec.ts`
   - `libs/leaderboard/src/leaderboard.service.spec.ts`

7. **Write missing e2e tests** (test/ directory):
   - `test/match-lifecycle.e2e-spec.ts` (Scenario 1)
   - `test/match-confirmation.e2e-spec.ts` (Scenario 2)
   - `test/match-lock.e2e-spec.ts` (Scenario 3)
   - `test/match-confirmation-cancel.e2e-spec.ts` (Scenario 4)
   - `test/admin-override.e2e-spec.ts` (Scenario 5)
   - `test/leaderboard.e2e-spec.ts` (Scenario 7)

---

### backend-auth — Remaining Tasks

1. **Fix APP_GUARD in apps/auth/app.module.ts**: Replace `ThrottlerGuard` as APP_GUARD with `JwtAuthGuard`. Throttling is already applied per-endpoint via `@Throttle()` decorators. The global ThrottlerGuard means unauthenticated requests to protected routes get throttler errors (429) instead of 401.

2. **Add `@nestjs/config` to package.json dependencies**: This package is used throughout `libs/auth/` and `apps/api/` but is completely absent from the installed node_modules. This is a blocker for any build.

3. **Write missing e2e tests**:
   - `test/auth-sso.e2e-spec.ts` (Scenario 6a–6h) — requires MSAL mock setup

4. **Optional — add `msal.strategy.spec.ts`**: The test-criteria spec names this file explicitly. The current `azure-ad.service.spec.ts` covers the Graph API logic but lacks the token validation and claims extraction scenarios. Either rename/add tests to meet spec naming or document the deviation.

---

### backend-jobs — Remaining Tasks

1. **Complete AuditLogProcessor**: Inject TypeORM `DataSource` or `AuditLogEntity` repository and persist the audit_log row in `process()` instead of only logging. This requires the worker app to have a DB connection (TypeOrmModule in `apps/worker/app.module.ts`).

2. **Add AuditLogProcessor unit test**: `apps/worker/src/processors/audit-log.processor.spec.ts` — test successful DB write, version mismatch, DLQ path.

3. **Implement DLQ inspection service**: Create a `DlqInspectorService` in `apps/worker/` or `apps/producer/` that wraps BullMQ queue API methods (`getFailed`, `getJob`). Export and provide it for consumption by `apps/api/AdminController` via a shared interface (or PM mediates adding it to `libs/events` exports).

---

### Shared / Architect — Remaining Tasks

1. **Fix `libs/database/src/data-source.ts`**: Add migrations 003–006 to the `migrations` array so `npm run migration:run` creates all tables, not just users+refresh_tokens.

2. **Install missing dependency `@nestjs/config`**: Add `@nestjs/config` to `package.json` dependencies. This is used in `libs/auth/auth.module.ts`, `libs/auth/auth.service.ts`, `libs/auth/azure-ad.service.ts`, `libs/auth/token.service.ts`, `apps/api/app.module.ts`, `apps/auth/app.module.ts`.

3. **Full `npm install`**: After adding `@nestjs/config` to package.json, run `npm install` to complete the node_modules installation (currently incomplete — `commander`, `import-local` are broken).

---

## Overall Completion Estimate

| Area | Endpoints | Entities | Business Logic | BullMQ | Unit Tests | E2E Tests |
|------|-----------|----------|----------------|--------|------------|-----------|
| backend-api | 95% (stub: dlq endpoints) | 100% | 85% (missing BullMQ publish) | 0% (not wired) | 0% (0/4 spec files) | 0% (0/6 e2e files) |
| backend-auth | 100% | 100% | 97% (minor APP_GUARD bug) | n/a | 85% (missing msal.strategy.spec) | 0% (0/1 e2e file) |
| backend-jobs | n/a | n/a | 90% (audit processor stub) | 80% (producer+consumer done; no API publish) | 80% (missing AuditLogProcessor spec) | n/a |
| Shared infra | 95% (missing @nestjs/config dep) | 100% | 90% (data-source.ts incomplete) | — | — | — |

**Global estimate: ~65% complete.**

The code written is high quality and architecturally sound. The two blocking gaps are:
1. BullMQ event publishing never wired into the match domain services (all 4 publish points missing).
2. No unit tests for the backend-api service layer (4 files), and no e2e tests across all areas (7 files).

The build cannot currently be verified due to incomplete npm install and missing `@nestjs/config` package.
