---
name: sprint-health
description: >-
  Quick mid-sprint health check across all teams. Use when pm needs a
  fast status overview without reading all files manually. Returns
  on-track / at-risk / blocked verdict with team breakdown.
license: MIT
metadata:
  author: agentflow
  version: "1.0"
  recommended_for: [pm]
---

# Skill: sprint-health

Fast sprint status check.

## Steps

1. Read `.agentflow/pm/sprints/sprint-XX/plan.md` — goals and milestones
2. Read all teams' `progress.md` — status field only
3. Read all teams' `issues.md` — blocked items
4. Read all teams' `shared/bugs.md` — open critical bugs

## Output

```markdown
## Sprint [XX] Health Check
Date: [date]

### Overall: 🟢 ON TRACK / 🟡 AT RISK / 🔴 BLOCKED

### Teams
| Team | Frontend | Backend | Blockers |
|------|----------|---------|----------|
| team-01 | 🟢 70% | 🟢 80% | None |
| team-02 | 🟡 40% | 🔴 BLOCKED | Waiting for spec |

### Milestones
| Milestone | Target | Forecast | Status |
|-----------|--------|----------|--------|

### Critical Open Bugs: [N]
[list]

### PM Actions needed
[list or "none"]

### Escalation needed
[list or "none"]
```

Return to PM.
