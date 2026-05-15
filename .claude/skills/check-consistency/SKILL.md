---
name: check-consistency
description: >-
  Compares team progress against architect specs at milestone. Use when
  architect needs to verify that what teams implemented matches api.yaml,
  schema.sql, and ui-components.md. Produces proceed/blocked verdict.
license: MIT
metadata:
  author: agentflow
  version: "1.0"
  recommended_for: [architect]
---

# Skill: check-consistency

Compare team implementation against specs at a milestone checkpoint.

## Steps

1. Read `.agentflow/architect/specs/api.yaml`
2. Read `.agentflow/architect/specs/schema.sql`
3. Read `.agentflow/architect/specs/ui-components.md`
4. Read `.agentflow/architect/specs/test-criteria.md`
5. For each active team read:
   - `.agentflow/teams/[team]/frontend/progress.md`
   - `.agentflow/teams/[team]/backend/progress.md`
   - `.agentflow/teams/[team]/shared/bugs.md`

6. For each spec item determine:
   - **Compliant** — implemented as specified
   - **Partial** — implemented but missing something
   - **Non-compliant** — deviates from spec
   - **Not covered** — not mentioned in progress

## Output

```markdown
## Consistency Report — Milestone [X]
Date: [date]

### API Endpoints
| Endpoint | Backend | Spec Ref | Notes |
|----------|---------|----------|-------|
| POST /auth/login | ✅ Compliant | api.yaml#/auth/login | |
| GET /users/{id} | ⚠️ Partial | api.yaml#/users/id | Missing 404 case |

### DB Schema
| Table | Status | Notes |
|-------|--------|-------|

### UI Components
| Component | Frontend | Spec Ref | Notes |
|-----------|----------|----------|-------|

### Test Criteria Coverage
| Criterion | Covered | Notes |
|-----------|---------|-------|

### Open Bugs: [N]
[critical bugs list]

### Verdict: PROCEED / BLOCKED
Blocking issues: [list or "none"]
Non-blocking to track: [list or "none"]
```

Return report to Architect.
