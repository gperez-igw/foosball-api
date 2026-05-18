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
