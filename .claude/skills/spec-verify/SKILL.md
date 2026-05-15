---
name: spec-verify
description: >-
  Compares actual source code against architect specs at milestone.
  Greps route definitions, DB models, and component files to verify
  they match api.yaml, schema.sql, and ui-components.md. Produces
  code-vs-spec compliance table. Use during architect milestone review.
license: MIT
metadata:
  author: agentflow
  version: "1.0"
  recommended_for: [code-reviewer, architect]
---

# Skill: spec-verify

Verify that committed source code matches architect specifications.
This is a structural check — it verifies existence and shape, not runtime behavior.

## Steps

### 1. API Routes vs api.yaml
1. Read `.agentflow/architect/specs/api.yaml` — extract all paths and methods
2. Find route definition files in source code:
   - Express/Fastify: grep for `router.get|post|put|delete|patch`
   - Django/Flask: grep for `@app.route|path(|@api_view`
   - Go: grep for `HandleFunc|Handle|router.`
   - Next.js/Remix: check `app/api/` or `pages/api/` directory structure
3. For each api.yaml endpoint, verify:
   - Route exists in source code
   - HTTP method matches
   - Path parameters match
   - Request body fields referenced (if handler reads them)
   - Response status codes present in handler

### 2. DB Schema vs schema.sql
1. Read `.agentflow/architect/specs/schema.sql` — extract all tables and columns
2. Find DB model/migration files in source code:
   - Prisma: `schema.prisma`
   - SQLAlchemy: grep for `class.*Model|Column(`
   - TypeORM: grep for `@Entity|@Column`
   - Drizzle: grep for `pgTable|sqliteTable`
   - Django: grep for `class.*models.Model`
   - Raw SQL: grep for `CREATE TABLE`
3. For each schema.sql table, verify:
   - Model/table exists in source
   - Required columns are present
   - Foreign key relationships defined

### 3. UI Components vs ui-components.md
1. Read `.agentflow/architect/specs/ui-components.md` — extract component inventory
2. Find component files in source code:
   - React: grep for `export.*function|export.*const` in `.tsx` files
   - Vue: grep for `<template>` in `.vue` files
   - Svelte: check `.svelte` files
3. For each spec component, verify:
   - Component file exists
   - Expected props/attributes referenced
   - Interaction states handled (check for loading/error/empty patterns)

## Output

```markdown
## Code-vs-Spec Verification — Milestone [X]
Date: [date]

### API Routes
| Endpoint | Method | In Spec | In Code | Match | Notes |
|----------|--------|---------|---------|-------|-------|
| /auth/login | POST | api.yaml#L42 | routes/auth.ts:15 | OK | |
| /users/{id} | GET | api.yaml#L78 | routes/users.ts:23 | MISMATCH | Missing 404 handler |
| /orders | POST | api.yaml#L120 | — | MISSING | Not implemented |

### DB Schema
| Table | In Spec | In Code | Match | Notes |
|-------|---------|---------|-------|-------|
| users | schema.sql#L5 | models/user.ts:8 | OK | |
| orders | schema.sql#L25 | — | MISSING | Model not created |

### UI Components
| Component | In Spec | In Code | Match | Notes |
|-----------|---------|---------|-------|-------|
| LoginForm | ui-components.md#L30 | components/LoginForm.tsx | OK | |
| Dashboard | ui-components.md#L55 | — | MISSING | Not implemented |

### Summary
- API: [X]/[Y] endpoints verified ([Z] missing, [W] mismatched)
- DB: [X]/[Y] tables verified
- UI: [X]/[Y] components verified
- Verdict: ALIGNED / GAPS FOUND
```

Return report to Architect for inclusion in milestone review.
