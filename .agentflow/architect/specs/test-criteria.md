---
id: spec-test-001
type: spec
project: foosball-api
sprint: "01"
created_by: architect
created_at: 2026-05-15
status: approved
requires_decision: false
---

# Test Criteria — foosball-api Sprint-01

## Overview

This document defines Given/When/Then acceptance criteria for every e2e flow in the
Definition of Done. Each scenario maps to an e2e test file in `test/`.

**Coverage target**: ≥ 80% statement coverage on libs/matches, libs/leaderboard,
libs/auth, libs/users.

**Quorum formula**: `quorumRequired = floor(totalPlayers / 2) + 1`
- 1v1 (2 players) → quorum = 2
- 2v2 (4 players) → quorum = 3
- 4v4 (8 players) → quorum = 5

---

## SCENARIO 1 — Full match lifecycle: create → players → result

**Test file**: `test/match-lifecycle.e2e-spec.ts`
**Owned by**: backend-api (primary implementer), QA (execution + report)

### 1a. Happy path: create → add players → submit result (2v2)

```gherkin
Given an authenticated user (user1) with a valid JWT
When  POST /api/v1/matches { matchType: "2v2" }
Then  response status is 201
And   response body has { status: "draft", matchType: "2v2", players: [] }
And   the match id is stored for subsequent steps

Given the match (id=X) in draft status
When  POST /api/v1/matches/X/players with 4 players
      (user1 team A slot 1, user2 team A slot 2, user3 team B slot 1, user4 team B slot 2)
Then  response status is 200
And   response body players array has length 4

Given the match (id=X) with 4 players registered
When  POST /api/v1/matches/X/result { scoreA: 5, scoreB: 3 }
Then  response status is 200
And   response body has { status: "awaiting_confirmation", scoreA: 5, scoreB: 3 }
```

### 1b. Default matchType is 2v2

```gherkin
Given an authenticated user
When  POST /api/v1/matches {} (no matchType field)
Then  response status is 201
And   response body has { matchType: "2v2" }
```

### 1c. Invalid matchType rejected

```gherkin
Given an authenticated user
When  POST /api/v1/matches { matchType: "3v3" }
Then  response status is 400
And   response body error.code is "VALIDATION_ERROR"
```

### 1d. Non-creator cannot add players

```gherkin
Given a match created by user1
When  user2 (different user, valid JWT) calls POST /api/v1/matches/X/players
Then  response status is 403
And   response body error.code is "FORBIDDEN_NOT_CREATOR"
```

### 1e. Capacity exceeded

```gherkin
Given a 2v2 match already with 4 players
When  POST /api/v1/matches/X/players with 1 additional player
Then  response status is 400
And   response body error.code contains "CAPACITY_EXCEEDED"
```

### 1f. Result submission with insufficient players

```gherkin
Given a 2v2 match with only 3 players registered
When  POST /api/v1/matches/X/result { scoreA: 5, scoreB: 3 }
Then  response status is 400
And   response body error.code is "INSUFFICIENT_PLAYERS"
```

### 1g. Unauthenticated request

```gherkin
Given no Authorization header
When  POST /api/v1/matches { matchType: "2v2" }
Then  response status is 401
```

---

## SCENARIO 2 — Confirmation quorum: quorum reached → result immutable

**Test file**: `test/match-confirmation.e2e-spec.ts`
**Owned by**: backend-api (primary), QA (execution)

### 2a. Quorum reached — match becomes confirmed

```gherkin
Given a 2v2 match (4 players: user1, user2, user3, user4) in awaiting_confirmation
And   quorumRequired = 3

When  user1 calls POST /api/v1/matches/X/confirmations
Then  response status is 200
And   confirmedCount = 1, quorumReached = false

When  user3 calls POST /api/v1/matches/X/confirmations
Then  confirmedCount = 2, quorumReached = false

When  user4 calls POST /api/v1/matches/X/confirmations
Then  confirmedCount = 3, quorumReached = true
And   response body quorumReached = true

When  GET /api/v1/matches/X
Then  response body has { status: "confirmed" }
And   confirmedAt is not null
```

### 2b. Confirmed match is immutable

```gherkin
Given a match with status "confirmed"

When  PATCH /api/v1/matches/X { scoreA: 9, scoreB: 0 }
Then  response status is 409
And   response body error.code is "MATCH_LOCKED"

When  POST /api/v1/matches/X/players (add a new player)
Then  response status is 409

When  POST /api/v1/matches/X/result { scoreA: 1, scoreB: 0 }
Then  response status is 409
```

### 2c. Duplicate confirmation is idempotent

```gherkin
Given user1 has already confirmed match X (in awaiting_confirmation)
When  user1 calls POST /api/v1/matches/X/confirmations again
Then  response status is 200
And   confirmedCount has NOT increased
```

### 2d. Non-player cannot confirm

```gherkin
Given match X in awaiting_confirmation with players [user1, user2, user3, user4]
When  user5 (valid JWT, not a player in this match) calls POST /api/v1/matches/X/confirmations
Then  response status is 403
And   response body error.code is "NOT_A_PLAYER"
```

### 2e. Confirmation state endpoint

```gherkin
Given match X in awaiting_confirmation with 2 of 3 quorum confirmations
When  GET /api/v1/matches/X/confirmations
Then  response status is 200
And   response body has { totalPlayers: 4, confirmedCount: 2, quorumRequired: 3, quorumReached: false }
And   confirmations array has 2 entries with userId and confirmedAt
```

---

## SCENARIO 3 — Modification blocked during confirmation phase

**Test file**: `test/match-lock.e2e-spec.ts`
**Owned by**: backend-api, QA

### 3a. Score update blocked in awaiting_confirmation

```gherkin
Given match X in status "awaiting_confirmation"
And   the calling user is the match creator

When  PATCH /api/v1/matches/X { scoreA: 9, scoreB: 0 }
Then  response status is 409
And   response body error.code is "MATCH_LOCKED"
And   response body error.details.status = "awaiting_confirmation"
```

### 3b. Player addition blocked in awaiting_confirmation

```gherkin
Given match X in status "awaiting_confirmation"
When  POST /api/v1/matches/X/players { players: [...] }
Then  response status is 409
And   response body error.code is "MATCH_LOCKED"
```

### 3c. Result resubmission blocked in awaiting_confirmation

```gherkin
Given match X in status "awaiting_confirmation"
When  POST /api/v1/matches/X/result { scoreA: 1, scoreB: 0 }
Then  response status is 409
```

---

## SCENARIO 4 — Creator cancels confirmation → quorum reset to 0

**Test file**: `test/match-confirmation-cancel.e2e-spec.ts`
**Owned by**: backend-api, QA

### 4a. Happy path: cancel → reset → edit → resubmit

```gherkin
Given match X in awaiting_confirmation with confirmedCount = 2
And   calling user is the match creator (user1)

When  POST /api/v1/matches/X/confirmations/cancel
Then  response status is 200
And   response body { confirmedCount: 0, quorumReached: false, confirmations: [] }

When  GET /api/v1/matches/X
Then  response body has { status: "playing" }
And   scoreA and scoreB still have original values

When  PATCH /api/v1/matches/X { scoreA: 7, scoreB: 2 }
Then  response status is 200
And   response body has { scoreA: 7, scoreB: 2, status: "playing" }

When  POST /api/v1/matches/X/result { scoreA: 7, scoreB: 2 }
Then  response status is 200
And   response body has { status: "awaiting_confirmation" }
```

### 4b. Non-creator cannot cancel

```gherkin
Given match X in awaiting_confirmation, created by user1
When  user2 calls POST /api/v1/matches/X/confirmations/cancel
Then  response status is 403
And   response body error.code is "FORBIDDEN_NOT_CREATOR"
```

### 4c. Cannot cancel a confirmed match

```gherkin
Given match X in status "confirmed"
When  match creator calls POST /api/v1/matches/X/confirmations/cancel
Then  response status is 409
And   response body error.code is "MATCH_ALREADY_CONFIRMED"
```

### 4d. Previous confirmation votes are gone after cancel

```gherkin
Given match X cancelled from confirmation (was awaiting_confirmation, now playing)
When  GET /api/v1/matches/X/confirmations
      (match is back in playing status — not in confirmation phase)
Then  response status is 409 with MATCH_NOT_AWAITING_CONFIRMATION
     (confirmations endpoint requires awaiting_confirmation status)
```

---

## SCENARIO 5 — Admin override of confirmed match result

**Test file**: `test/admin-override.e2e-spec.ts`
**Owned by**: backend-api, QA

### 5a. Admin overrides score on confirmed match

```gherkin
Given match X with status "confirmed", scoreA=5, scoreB=3
And   requesting user has is_admin=true in JWT

When  PATCH /api/v1/admin/matches/X/result
      { scoreA: 6, scoreB: 3, reason: "Score entry error" }
Then  response status is 200
And   response body match.scoreA = 6, match.scoreB = 3
And   response body match.status = "confirmed"
And   response body auditLog.action = "result_override"
And   response body auditLog.beforeData = { scoreA: 5, scoreB: 3 }
And   response body auditLog.afterData  = { scoreA: 6, scoreB: 3 }
And   response body auditLog.reason = "Score entry error"
And   response body auditLog.actorId = <admin user id>
```

### 5b. Audit log persisted

```gherkin
Given the admin override from 5a was applied

When  GET /api/v1/admin/matches/X/audit
Then  response status is 200
And   response body data array has at least 1 entry
And   first entry has action="result_override", entityId=X
```

### 5c. Non-admin cannot override

```gherkin
Given match X in confirmed status
And   requesting user has is_admin=false in JWT

When  PATCH /api/v1/admin/matches/X/result { scoreA: 1, scoreB: 0 }
Then  response status is 403
And   response body error.code = "FORBIDDEN_ADMIN_REQUIRED"
```

### 5d. Admin cannot override non-confirmed match

```gherkin
Given match X in status "awaiting_confirmation"
And   requesting user has is_admin=true

When  PATCH /api/v1/admin/matches/X/result { scoreA: 1, scoreB: 0 }
Then  response status is 409
And   response body error.code = "MATCH_NOT_CONFIRMED"
```

### 5e. Audit log is append-only (two overrides → two entries)

```gherkin
Given match X confirmed, admin overrides once (entry 1 in audit_log)
When  admin overrides again { scoreA: 7, scoreB: 3, reason: "Second correction" }
Then  response status is 200
And   GET /api/v1/admin/matches/X/audit returns 2 entries (both preserved)
```

---

## SCENARIO 6 — Azure SSO login: token validated, is_admin sourced from DB

**Test file**: `test/auth-sso.e2e-spec.ts`
**Owned by**: backend-auth, QA

### 6a. New user login — is_admin defaults to false

```gherkin
Given a valid Azure AD authorization code (stub: mock MSAL in test environment)
And   the decoded OIDC token contains { oid, preferred_username, name }
And   no user row exists in the DB for this azure_oid

When  GET /connect?code=...&state=...
Then  response status is 200
And   response body has { accessToken, refreshToken, expiresIn: 900 }
And   the JWT payload (decoded) contains { is_admin: false, email, sub }
And   users table has a new row with is_admin=0 for this azure_oid
And   refresh_tokens table has a new row (used_at IS NULL)
```

### 6b. Existing admin user — is_admin preserved from DB

```gherkin
Given a user row already exists in the DB with is_admin=1 for azure_oid=X
And   a valid OIDC token for the same azure_oid=X

When  GET /connect?code=...&state=...
Then  response status is 200
And   JWT payload contains { is_admin: true }
And   users.is_admin remains 1 (upsert did NOT overwrite it)
```

### 6c. GET /auth/me returns correct profile

```gherkin
Given a user logged in with a valid access token

When  GET /auth/me (Authorization: Bearer <accessToken>)
Then  response status is 200
And   response body has { id, email, displayName, isAdmin }
And   isAdmin matches the value in the JWT payload
```

### 6d. Token refresh — single-use rotation

```gherkin
Given a user with refreshToken = T1

When  POST /auth/refresh { refreshToken: T1 }
Then  response status is 200
And   response body has new { accessToken, refreshToken: T2 }
And   T1 is no longer usable (used_at is set)

When  POST /auth/refresh { refreshToken: T1 } (using T1 again)
Then  response status is 401
And   response body error.code = "INVALID_REFRESH_TOKEN"
```

### 6e. Expired refresh token rejected

```gherkin
Given a refresh token with expires_at in the past (simulate)
When  POST /auth/refresh { refreshToken: <expired> }
Then  response status is 401
And   response body error.code = "INVALID_REFRESH_TOKEN"
```

### 6f. Logout invalidates refresh token

```gherkin
Given a user logged in (holds accessToken + refreshToken T1)

When  POST /auth/logout { refreshToken: T1 } (with valid Bearer)
Then  response status is 204

When  POST /auth/refresh { refreshToken: T1 }
Then  response status is 401
```

---

## SCENARIO 6b — Mobile OAuth2 code exchange (Flow B)

**Test file**: `test/auth-mobile-exchange.e2e-spec.ts` (new) and unit additions in existing spec files
**Owned by**: backend-auth (primary), QA (execution)

### 6b-1. GET /auth/login?client=mobile returns JSON url

```gherkin
Given the auth service is running with AZURE_MOBILE_REDIRECT_URI configured

When  GET /auth/login?client=mobile
Then  response status is 200
And   response body has { url: string }
And   url contains "redirect_uri=foosball%3A%2F%2Fauth%2Fcallback" (or the configured value URL-encoded)
And   url contains "client_id=<AZURE_CLIENT_ID>"
```

### 6b-2. GET /auth/login (no client param) still returns 302 — web flow unchanged

```gherkin
Given the auth service is running

When  GET /auth/login  (no query params)
Then  response status is 302
And   Location header starts with "https://login.microsoftonline.com/"
```

### 6b-3. GET /auth/login?client=web returns 302 — explicit web flow

```gherkin
When  GET /auth/login?client=web
Then  response status is 302
And   Location header is present and starts with "https://login.microsoftonline.com/"
```

### 6b-4. POST /connect/exchange — happy path (new user)

```gherkin
Given MSAL is stubbed to return a valid AuthenticationResult for code="valid-code" state="valid-state"
  with idTokenClaims: { oid: "oid-mobile-1", preferred_username: "mobile@company.com", name: "Mobile User" }
And   no user row exists for azure_oid="oid-mobile-1"

When  POST /connect/exchange { code: "valid-code", state: "valid-state" }
Then  response status is 200
And   response body has { accessToken, refreshToken, expiresIn: 900 }
And   users table has a new row with email="mobile@company.com", is_admin=0
And   refresh_tokens table has a new row (used_at IS NULL)
And   JWT payload (decoded) contains { is_admin: false, email: "mobile@company.com" }
```

### 6b-5. POST /connect/exchange — existing admin user, is_admin preserved

```gherkin
Given a user row exists with azure_oid="oid-admin-mobile", is_admin=1
And   MSAL stub returns idTokenClaims with oid="oid-admin-mobile"

When  POST /connect/exchange { code: "valid-code", state: "valid-state" }
Then  response status is 200
And   JWT payload contains { is_admin: true }
And   users.is_admin remains 1 (upsert did NOT overwrite it)
```

### 6b-6. POST /connect/exchange — missing code rejected

```gherkin
When  POST /connect/exchange { state: "valid-state" }  (no code field)
Then  response status is 400
And   response body error.code = "INVALID_CALLBACK"
```

### 6b-7. POST /connect/exchange — missing state rejected

```gherkin
When  POST /connect/exchange { code: "valid-code" }  (no state field)
Then  response status is 400
And   response body error.code = "INVALID_CALLBACK"
```

### 6b-8. POST /connect/exchange — empty code rejected

```gherkin
When  POST /connect/exchange { code: "", state: "valid-state" }
Then  response status is 400
And   response body error.code = "INVALID_CALLBACK"
```

### 6b-9. POST /connect/exchange — MSAL rejects code (expired/already used)

```gherkin
Given MSAL stub throws an error for code="stale-code" (expired or already consumed)

When  POST /connect/exchange { code: "stale-code", state: "valid-state" }
Then  response status is 401
And   response body error.code = "MOBILE_EXCHANGE_FAILED"
```

### 6b-10. POST /connect/exchange — MSAL rejects redirect_uri mismatch

```gherkin
Given MSAL is configured with AZURE_MOBILE_REDIRECT_URI="foosball://auth/callback"
And   MSAL stub simulates a redirect_uri_mismatch error

When  POST /connect/exchange { code: "some-code", state: "valid-state" }
Then  response status is 401
And   response body error.code = "MOBILE_EXCHANGE_FAILED"
```

### Unit test additions (backend-auth)

| File | New test cases |
|------|---------------|
| `libs/auth/src/azure-ad.service.spec.ts` | `getAuthCodeUrl(webUri)` uses webUri; `getAuthCodeUrl(mobileUri)` uses mobileUri; `exchangeCode(code, state, mobileUri)` passes mobileUri to MSAL |
| `libs/auth/src/auth.service.spec.ts` | `getLoginUrl('web')` calls `getAuthCodeUrl(webUri)`; `getLoginUrl('mobile')` calls `getAuthCodeUrl(mobileUri)`; `handleMobileExchange(code, state)` calls `exchangeCode(..., mobileUri)` then upserts user and returns TokenPair |
| `apps/auth/src/connect.controller.spec.ts` | `POST /connect/exchange` with valid body → 200 TokenPair; missing `code` → 400; missing `state` → 400; MSAL error → 401 |
| `apps/auth/src/auth.controller.spec.ts` | `GET /auth/login?client=mobile` returns 200 JSON `{ url }`; `GET /auth/login?client=web` returns 302; default (no param) returns 302 |

---

## SCENARIO 7 — Leaderboard: correct values on all 4 time filters

**Test file**: `test/leaderboard.e2e-spec.ts`
**Owned by**: backend-api (leaderboard lib), QA

### Setup (shared before/beforeAll)

```
Seed: 5 confirmed matches with known winners and confirmed_at timestamps:
  M1: confirmed_at = today (this week, this month, this year)     → winner: user1
  M2: confirmed_at = 6 days ago (this week, this month, this year) → winner: user2
  M3: confirmed_at = 20 days ago (this month, this year)          → winner: user1
  M4: confirmed_at = 40 days ago (this year)                      → winner: user3
  M5: confirmed_at = 400 days ago (none of the above filters)     → winner: user3
All matches are 2v2: user1+user2 vs user3+user4.
In M1, M2, M3: team A wins (user1, user2).
In M4, M5: team B wins (user3, user4).
```

### 7a. Filter: week

```gherkin
When  GET /api/v1/leaderboard/users?filter=week
Then  response status is 200
And   response body data has user1.wins = 1, user2.wins = 1
      (only M1 falls in "this week"; M2 is 6 days ago = within 7 days)
      Wait — M2 is 6 days ago → also in week. Adjust seed or query definition.
      CLARIFICATION: "week" = last 7 calendar days. Both M1 and M2 qualify.
      user1.wins = 2, user2.wins = 2 (both on winning team for M1 and M2)
And   user3 and user4 have 0 wins for this filter
```

### 7b. Filter: month

```gherkin
When  GET /api/v1/leaderboard/users?filter=month
Then  response body data includes user1.wins = 3, user2.wins = 3
      (M1 + M2 + M3 fall in current month... adjust if M3 = 20 days ago still in month)
      CLARIFICATION: "month" = last 30 calendar days. M1+M2+M3 ≤ 30 days ago.
      user1.wins = 3, user2.wins = 3; user3.wins = 0
```

### 7c. Filter: year

```gherkin
When  GET /api/v1/leaderboard/users?filter=year
Then  response body data includes all 4 matches within last 365 days
      user1.wins = 3, user2.wins = 3, user3.wins = 1, user4.wins = 1
      (M4 winner is team B = user3 + user4)
```

### 7d. Filter: total

```gherkin
When  GET /api/v1/leaderboard/users?filter=total
Then  all 5 matches counted
      user1.wins = 3, user2.wins = 3, user3.wins = 2, user4.wins = 2
```

### 7e. Pair leaderboard — week

```gherkin
When  GET /api/v1/leaderboard/pairs?filter=week
Then  response body data includes the pair (user1, user2) with wins = 2
      (they were on the same winning team for M1 and M2)
```

### 7f. Pair leaderboard — total

```gherkin
When  GET /api/v1/leaderboard/pairs?filter=total
Then  pair (user1, user2) wins = 3
And   pair (user3, user4) wins = 2
And   pair (user1, user2) ranked 1st
```

### 7g. Cache hit after first request

```gherkin
Given leaderboard users?filter=week was called once (cache MISS, populated)
When  GET /api/v1/leaderboard/users?filter=week again
Then  response status is 200
And   X-Cache header = "HIT"
```

### 7h. Cache invalidated after new match confirmed

```gherkin
Given leaderboard users?filter=week is cached
When  a new match is confirmed (quorum reached via POST /confirmations)
And   BullMQ leaderboard-invalidate event is processed by worker
When  GET /api/v1/leaderboard/users?filter=week
Then  X-Cache header = "MISS" (cache was cleared)
And   new winner appears in results
```

### 7i. Invalid filter

```gherkin
When  GET /api/v1/leaderboard/users?filter=quarter
Then  response status is 400
And   response body error.code = "VALIDATION_ERROR"
```

---

## UNIT TEST REQUIREMENTS (per implementer)

### backend-auth owns (MatchService coverage embedded here)

| File | Required unit tests | Coverage target |
|------|---------------------|-----------------|
| `libs/auth/src/msal.strategy.spec.ts` | validates token, extracts claims (oid/email/name only) | 80%+ |
| `libs/users/src/user.service.spec.ts` | upsert on login (new user → is_admin=false; existing → is_admin preserved), displayName update | 80%+ |
| `libs/auth/src/refresh-token.service.spec.ts` | issue, validate, single-use rotation, expiry | 80%+ |

### backend-api owns

| File | Required unit tests | Coverage target |
|------|---------------------|-----------------|
| `libs/matches/src/match.service.spec.ts` | create, addPlayers capacity/slot logic, submitResult, status transitions | 80%+ |
| `libs/matches/src/confirmation.service.spec.ts` | vote record, quorum calc, cancel reset, idempotency | 80%+ |
| `libs/matches/src/admin-override.service.spec.ts` | score override, audit log write, rollback on BullMQ failure | 80%+ |
| `libs/leaderboard/src/leaderboard.service.spec.ts` | wins query per filter, cache hit/miss/bypass, pair computation | 80%+ |

### backend-jobs owns

| File | Required unit tests | Coverage target |
|------|---------------------|-----------------|
| `libs/events/src/event-envelope.spec.ts` | EventEnvelope shape, version field present | 80%+ |
| `apps/worker/src/processors/match-confirmed.processor.spec.ts` | process job, handle version mismatch, DLQ path | 80%+ |
| `apps/worker/src/processors/leaderboard-invalidate.processor.spec.ts` | Redis key deletion | 80%+ |
| `apps/producer/src/leaderboard-cron.service.spec.ts` | cron trigger, publishes correct event | 80%+ |

---

## BullMQ EVENT CONTRACTS (for test assertions)

All inter-service events use `EventEnvelope<T>`:

```typescript
// match.result_submitted (published by backend-api on POST /matches/:id/result)
EventEnvelope<{ matchId: number; matchType: string; scoreA: number; scoreB: number }> version=1

// match.confirmed (published by backend-api when quorum reached)
EventEnvelope<{ matchId: number; confirmedAt: string; winnerTeam: 'A' | 'B' | 'draw' }> version=1

// match.confirmation_cancelled (published by backend-api on POST /confirmations/cancel)
EventEnvelope<{ matchId: number; cancelledBy: number }> version=1

// leaderboard-invalidate (published by backend-api on match.confirmed)
EventEnvelope<{ reason: string; affectedFilters: string[] }> version=1
// affectedFilters: ['week', 'month', 'year', 'total'] (all invalidated for simplicity)

// audit-log-write (published by backend-api on admin override — CRITICAL event)
EventEnvelope<{ entityType: string; entityId: number; action: string; actorId: number; beforeData: object; afterData: object; reason: string | null }> version=1
// Worker writes this to audit_logs table. If this event fails, operation is rolled back.
```

Workers must check `job.data.version === 1` before destructuring.
If version mismatch: log warning, move job to DLQ, do NOT process.

---

## MIGRATION SEQUENCE VERIFICATION

The QA agent must verify during M1 milestone that migrations run successfully
in the required order on a fresh MySQL instance:

```
1. npx typeorm migration:run -d dist/libs/database/src/data-source.js
   Expected: users + refresh_tokens created (Phase 1)
   Expected: matches + match_players + match_confirmations + audit_logs created (Phase 2)

2. Verify FK integrity: INSERT a match with invalid created_by → FK error expected.
3. Verify CHECK constraints: INSERT match with match_type='3v3' → error expected.
4. Verify UNSIGNED score: INSERT match with score_a=-1 → error expected.
```

---

## JEST + MODULE RESOLUTION VALIDATION (M1 — first test run)

Before implementers write any test, validate the following in a fresh check:

```
1. tsconfig.test.json exists with { "module": "CommonJS", "moduleResolution": "node" }
2. jest.config.js (or package.json jest block) uses ts-jest with tsconfig: "tsconfig.test.json"
3. Module path aliases (@app/common, @app/matches, etc.) resolve correctly in test context.
4. Run: npx jest --passWithNoTests → exit 0
```

If this fails, report blocker to PM immediately (blocks all test writing).
