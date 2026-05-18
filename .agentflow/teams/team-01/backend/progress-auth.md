---
id: progress-auth-001
type: progress
project: foosball-api
sprint: "01"
team: team-01
created_by: backend-auth
created_at: 2026-05-18
status: milestone-ready
requires_decision: false
---

# Backend-Auth Progress — Sprint 01

## Summary

All three remaining delta tasks are complete. Build passes. 44/44 unit tests pass.
E2E test file is written but cannot run yet due to a cross-area blocker (see below).

---

## Tasks Completed

### Task 1 — Fix APP_GUARD in apps/auth/src/app.module.ts

**Status: DONE**

Replaced `ThrottlerGuard` as `APP_GUARD` with `JwtAuthGuard` (from `@app/auth`).
Throttling still applied per-endpoint via `@Throttle()` decorators on `login` and `refresh`.

Also fixed pre-existing TypeScript compile errors in controllers:
- `apps/auth/src/auth.controller.ts`: replaced `FastifyRequest` type with local `AuthRequest` interface
- `apps/auth/src/users.controller.ts`: same fix

These were blocking `npm run build:auth` (TS2339: Property 'user' does not exist on FastifyRequest).
The api app had already used the same `AuthRequest` pattern; brought auth app into alignment.

### Task 2 — Write test/auth-sso.e2e-spec.ts (Scenarios 6a–6h)

**Status: WRITTEN — blocked by jest-e2e.json (cross-area)**

File: `test/auth-sso.e2e-spec.ts`
Covers: Scenarios 6a through 6h per test-criteria.md § SCENARIO 6.

Test strategy:
- NestJS `TestingModule` with full app wired (AuthModule, UsersModule, controllers, JwtAuthGuard as APP_GUARD)
- `@azure/msal-node` mocked via `jest.mock('@azure/msal-node')` at module level
- `global.fetch` mocked for Graph API calls
- TypeORM repositories replaced with in-memory Map-based mocks (no real DB)
- ConfigService overridden with fixed test values
- JwtService uses real signing with test secret — tokens decoded to assert `is_admin`, `email`, `sub`

Scenarios covered:
- 6a: Admin group in token → is_admin:true in JWT + users row
- 6b: Non-admin group → is_admin:false
- 6c: GET /auth/me returns correct profile
- 6d: Refresh token single-use rotation (T1→T2, T1 replay fails)
- 6e: Expired refresh token rejected (401 INVALID_REFRESH_TOKEN)
- 6f: Graph API fallback when `_claim_names.groups` present → is_admin:true
- 6g: Graph API 503 on both retries → 503 AZURE_GRAPH_UNAVAILABLE
- 6h: Logout invalidates token (204 then 401 on refresh)

**Cross-area blocker**: `test/jest-e2e.json` is missing the `.js` extension stripping patterns
(`@app/auth/(.+)\.js$`, etc.) that `package.json` jest config has. As a result, running
`npx jest --config test/jest-e2e.json test/auth-sso.e2e-spec.ts` fails with:
"Cannot find module './refresh-token.entity.js'".
This affects ALL e2e tests, not just auth. Fix needed in `test/jest-e2e.json` (shared infra,
owned by PM/Architect). See issues.md for formal file.

### Task 3 — Add libs/auth/src/msal.strategy.spec.ts

**Status: DONE**

File: `libs/auth/src/msal.strategy.spec.ts`
Covers token validation and claims extraction scenarios as required by test-criteria.md.

Design note: The project uses `AzureAdService` (not a Passport `MsalStrategy` class).
The spec names `msal.strategy.spec.ts` but the implementation never has a separate strategy class.
This file covers the same logic by testing `AuthService.handleCallback()` and `AzureAdService`
together — satisfying the spec's intent (token validation, claims extraction, missing groups handling).

Test scenarios:
- Token validation: rejects empty code/state, calls MSAL with correct args
- Claims extraction: oid → azureOid, preferred_username/email → email, name → displayName
- Role assignment: admin group in groups array → is_admin:true; non-admin/empty → is_admin:false
- Missing groups / Graph fallback: `_claim_names.groups` triggers `getGroupsFromGraph`; absent groups → is_admin:false; Graph unavailable propagates
- No Graph call when groups claim is present or entirely absent
- Token pair structure: expiresIn=900, correct fields
- Call order: upsertFromAzure before issueTokenPair

---

## Build Status

```
npm run build:auth → SUCCESS (0 errors)
```

## Test Results

```
npx jest libs/auth libs/users apps/auth --no-coverage --runInBand

Test Suites: 5 passed, 5 total
Tests:       44 passed, 44 total
Snapshots:   0 total
Time:        ~4s
```

Suites:
- libs/auth/src/auth.service.spec.ts — 5 tests PASS
- libs/auth/src/azure-ad.service.spec.ts — 3 tests PASS
- libs/auth/src/refresh-token.service.spec.ts — 8 tests PASS
- libs/auth/src/msal.strategy.spec.ts — 19 tests PASS (NEW)
- libs/users/src/user.service.spec.ts — 9 tests PASS

---

## Blockers

### BLOCKER: test/jest-e2e.json missing .js extension mapper patterns

- **File**: `test/jest-e2e.json` (not in my write scope)
- **Problem**: e2e jest config lacks `"@app/auth/(.+)\\.js$"` and equivalent patterns for all `@app/*` aliases. The main `package.json` jest config has these. Without them, any e2e test that imports a module using `.js` extension imports fails.
- **Impact**: `test/auth-sso.e2e-spec.ts` cannot run. All other e2e tests are similarly blocked.
- **Fix needed**: Add `.js` stripping patterns to `test/jest-e2e.json` (same as `package.json` jest config). Formally filed in `issues.md`.
- **Workaround**: None available without modifying `jest-e2e.json`.

---

## Spec References

- api.yaml: authLogin, authCallback, authRefresh, authLogout, authMe, getMyProfile, updateMyProfile
- schema.sql: users table, refresh_tokens table
- test-criteria.md: Scenario 6 (6a–6h), Unit tests backend-auth section
- architecture.md: §Auth, §JWT, §Azure SSO
