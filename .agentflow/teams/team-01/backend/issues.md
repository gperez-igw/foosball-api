---
id: issue-auth-001
type: issue
project: foosball-api
sprint: "01"
team: team-01
created_by: backend-auth
created_at: 2026-05-18
status: blocked
requires_decision: false
issue_type: technical
---

# Issues — Backend-Auth

## ISSUE-AUTH-001: test/jest-e2e.json missing .js extension moduleNameMapper patterns

**Type**: technical (shared infrastructure)
**Status**: open — blocking e2e tests
**Filed by**: backend-auth
**Affects**: ALL e2e tests in `test/` directory

### Problem

`test/jest-e2e.json` moduleNameMapper does not include `.js` extension stripping patterns.
The source code throughout `libs/auth/`, `libs/users/`, etc. uses nodenext-style imports
with `.js` extensions (e.g., `import { X } from './foo.js'`).

The main `package.json` jest config correctly handles this with entries like:
```json
"@app/auth/(.+)\\.js$": "<rootDir>/libs/auth/src/$1"
"^(\\.{1,2}/.+)\\.js$": "$1"
```

But `test/jest-e2e.json` only has:
```json
"@app/auth/(.*)": "<rootDir>/../libs/auth/src/$1"
```

When jest resolves `./refresh-token.entity.js` → `libs/auth/src/refresh-token.entity.js`
(a JS file that doesn't exist), it fails.

### Fix Required

Add `.js` stripping patterns to `test/jest-e2e.json`:
```json
{
  "moduleNameMapper": {
    "^(\\.{1,2}/.+)\\.js$": "$1",
    "@app/auth/(.+)\\.js$": "<rootDir>/../libs/auth/src/$1",
    "@app/auth/(.*)": "<rootDir>/../libs/auth/src/$1",
    "@app/auth": "<rootDir>/../libs/auth/src/index.ts",
    "@app/users/(.+)\\.js$": "<rootDir>/../libs/users/src/$1",
    "@app/users/(.*)": "<rootDir>/../libs/users/src/$1",
    "@app/users": "<rootDir>/../libs/users/src/index.ts",
    "@app/common/(.+)\\.js$": "<rootDir>/../libs/common/src/$1",
    "@app/common/(.*)": "<rootDir>/../libs/common/src/$1",
    ... (same pattern for all @app/* aliases)
  }
}
```

### Impact

Without this fix:
- `test/auth-sso.e2e-spec.ts` cannot run
- All other e2e tests that import from `@app/*` modules will fail

### Owner for Fix

Shared infrastructure — PM/Architect to fix `test/jest-e2e.json`.

---

## ISSUE-JOBS-001: LeaderboardModule Redis db:1 vs worker db:0 — cross-area alignment needed

**Type**: technical (cross-area)
**Status**: open — requires backend-api team to fix `libs/leaderboard/src/leaderboard.module.ts`
**Filed by**: backend-jobs
**Affects**: IMP-04 cache invalidation correctness

### Problem

IMP-04 fix (code review) required removing `db: 1` from the worker Redis config so the
worker deletes keys from the same Redis database that `LeaderboardService` writes to.

The worker's `WORKER_REDIS` factory in `apps/worker/src/app.module.ts` now omits `db`,
defaulting to `db: 0`.

However, `libs/leaderboard/src/leaderboard.module.ts` (owned by backend-api) still uses
`db: 1` in its `LEADERBOARD_REDIS` factory:
```typescript
return new Redis({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  db: 1,   // <-- this must be removed
});
```

This means cache keys are still written on `db: 1` but deleted on `db: 0`.
Cache invalidation will still silently do nothing until this is aligned.

### Fix Required

In `libs/leaderboard/src/leaderboard.module.ts`, remove the `db: 1` line so the
`LEADERBOARD_REDIS` factory also uses `db: 0` (the default). Both Redis clients must
be on the same database index.

### Owner for Fix

backend-api team — file is `libs/leaderboard/src/leaderboard.module.ts`.
