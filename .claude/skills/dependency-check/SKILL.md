---
name: dependency-check
description: >-
  Verifies that spec changes or scope modifications don't silently impact
  other teams. Use when architect modifies specs and needs to know which
  teams must be notified and what actions they need to take.
license: MIT
metadata:
  author: agentflow
  version: "1.0"
  recommended_for: [architect]
---

# Skill: dependency-check

Verify cross-team impact when specs change.

## Steps

1. Read `.agentflow/architect/setup/teams.md` — all team scopes and dependencies
2. Read the modified spec or CR
3. For each team check:
   - Are modified endpoints/tables in their scope?
   - Do their endpoints/tables depend on changed ones?
   - Are shared data structures affected?

## Output

```markdown
## Dependency Impact Report
Date: [date]
Change: [brief description]

### Team Impact
| Team | Role | Impact | Details |
|------|------|--------|---------|
| team-01 | frontend | Direct | Consumes modified POST /auth/login |
| team-01 | backend | Direct | Must implement new table |
| team-02 | backend | Indirect | users table modified, verify FK integrity |

### Notifications required
- team-01: YES — update implementation
- team-02 backend: YES — verify foreign keys

### Spec sections to update
- api.yaml: [sections]
- schema.sql: [sections]
- ui-components.md: [sections or "none"]
```

Return report to Architect.
