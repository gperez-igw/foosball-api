---
name: backlog-prioritizer
description: >-
  Proposes sprint prioritization from backlog with rationale. Use when pm
  is planning a new sprint and needs a structured proposal of which backlog
  items to include, scored by value, risk, effort, and dependencies.
license: MIT
metadata:
  author: agentflow
  version: "1.0"
  recommended_for: [pm]
---

# Skill: backlog-prioritizer

Produce prioritized sprint plan from backlog.

## Steps

1. Read `.agentflow/pm/backlog.md`
2. Read last sprint `summary.md` if exists
3. Read `.agentflow/architect/setup/teams.md` — team capacities
4. Read open CRs in `.agentflow/architect/change-requests/`
5. Read `.agentflow/decisions/decision-*.md` for prioritization hints

6. Score each item: Business value (H/M/L), Technical risk (H/M/L),
   Dependencies (Blocking/Blocked-by/Independent), Effort (S/M/L)

## Output

```markdown
## Sprint [XX+1] — Proposed Prioritization
Date: [date]

### Proposed Sprint Goal
[One sentence]

### Selected Items
| Priority | Item | Value | Risk | Effort | Team | Rationale |
|----------|------|-------|------|--------|------|-----------|

### Deferred Items
| Item | Reason |
|------|--------|

### Open CRs to include
| CR | Recommendation |
|----|----------------|

### Risks
[risk and mitigation]
```

Return to PM.
