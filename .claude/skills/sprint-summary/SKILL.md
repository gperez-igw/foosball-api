---
name: sprint-summary
description: >-
  Aggregates all sprint data into a PR-ready summary document. Use when
  pm needs to produce the end-of-sprint summary for user review and PR
  creation. Reads all team progress, milestone reviews, and decisions.
license: MIT
metadata:
  author: agentflow
  version: "1.0"
  recommended_for: [pm]
---

# Skill: sprint-summary

Aggregate sprint data into summary.md for PR review.

## Steps

1. Read `.agentflow/pm/sprints/sprint-XX/plan.md` — original goals
2. Read all team `progress.md` and `bugs.md`
3. Read all `.agentflow/architect/reviews/milestone-XX.md` for this sprint
4. Read open CRs in `.agentflow/architect/change-requests/`
5. Read `.agentflow/decisions/decision-*.md` (and `.agentflow/decisions/log.md` legacy) for decisions made this sprint

## Output — write to `.agentflow/pm/sprints/sprint-XX/summary.md`

```markdown
---
id: summary-sprint-XX
type: summary
project: [project]
sprint: XX
created_by: pm
created_at: [date]
status: completed
requires_decision: true
---

# Sprint XX Summary

## Goals
| Goal | Status | Notes |
|------|--------|-------|
| [goal] | ✅ / ⚠️ / ❌ | [reason] |

## Milestones
| Milestone | Verdict | Date |
|-----------|---------|------|

## Implemented
### Backend — [list of endpoints and DB changes]
### Frontend — [list of components and features]

## Known Issues
| Issue | Team | Severity | Status |
|-------|------|----------|--------|

## Change Requests
| CR | Status | Decision |
|----|--------|----------|

## Decisions This Sprint
- [date]: [summary]

## Recommendations for Sprint [XX+1]
- [recommendation]

## PR Checklist
- [ ] All milestone-ready items implemented
- [ ] No open blocking bugs
- [ ] All CRs resolved or deferred
- [ ] Architecture docs up to date
- [ ] Test criteria met

---
⚠️ Review and create PR. The lead will present this to the user for approval.
```

Return file path to PM.
