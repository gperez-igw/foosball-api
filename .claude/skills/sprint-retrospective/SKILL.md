---
name: sprint-retrospective
description: >-
  Analyzes sprint execution using project artifacts to produce a structured
  retrospective. Use at sprint end, after summary and changelog, before
  git-ops commit. Identifies patterns in agent performance, bug cycles,
  decision latency, and scope violations.
license: MIT
metadata:
  author: agentflow
  version: "2.0"
  recommended_for: [pm]
---

# Skill: sprint-retrospective

Analyze sprint execution and produce a data-driven retrospective.

## Data Sources

1. **`.agentflow/pm/sprints/sprint-XX/plan.md`** — original goals and milestones
2. **`.agentflow/pm/sprints/sprint-XX/summary.md`** — what was accomplished
3. **`.agentflow/pm/sprints/sprint-XX/status.md`** — sprint health over time
4. **All team `progress.md` and `issues.md`** — team execution details
5. **`.agentflow/teams/*/shared/bugs.md`** — bug lifecycle data
6. **`.agentflow/architect/reviews/milestone-XX.md`** — milestone reviews for this sprint
7. **`.agentflow/architect/change-requests/cr-*.md`** — CRs opened during sprint
8. **`.agentflow/teams/*/qa/report.md`** — QA results

## Steps

1. Read sprint plan — extract original goals, milestones, and team assignments
2. Read summary and status — compare accomplished vs planned
3. Read all team progress and issues — extract blocked items, retry patterns, escalations
4. Read bugs files — count opened vs resolved, severity breakdown
5. Read architect reviews — note PROCEED vs BLOCKED verdicts and reasons
6. Read change requests — count, triggers, resolution time
7. Review decision flow — time between decision requests and resolutions (from message timestamps if available)
8. Synthesize findings into retrospective

## Output — write to `.agentflow/pm/sprints/sprint-XX/retrospective.md`

```markdown
---
id: retro-sprint-XX
type: retrospective
project: [project]
sprint: XX
created_by: pm
created_at: [date]
status: completed
---

# Sprint XX Retrospective

## Execution Summary

| Milestone | Planned | Delivered | Reviews | Outcome |
|-----------|---------|-----------|---------|---------|
| M1 | [date] | [date] | [N] | PASS/BLOCKED |

**Sprint duration**: [start date to end date]
**Goals met**: [N of M]

## Agent Performance

| Agent/Team | Tasks | Blocked items | Escalations | Notes |
|------------|-------|---------------|-------------|-------|
| [team-XX/frontend] | [N] | [N] | [N] | |
| [team-XX/backend] | [N] | [N] | [N] | |
| reviewer | [N] | [N] | [N] | |

## Bug Cycle

| Metric | Count |
|--------|-------|
| Bugs opened | [N] |
| Bugs resolved | [N] |
| Critical/High | [N] |
| Still open | [N] |

## Change Requests

| CR | Trigger | Required User Decision | Resolved |
|----|---------|----------------------|----------|
| [cr-NNN] | [what prompted it] | yes/no | yes/no |

## Decision Flow

| Decision | Complexity | Notes |
|----------|------------|-------|
| [topic] | [simple/complex] | [how it was resolved] |

## Scope Notes

Any files written outside expected ownership areas. Use `file-ownership-verify`
skill for detailed analysis if violations are suspected.

## What Went Well
- [data-backed positive observations]

## What Went Poorly
- [data-backed problems: high block rates, recurring errors, long resolution times]

## Action Items for Next Sprint
- [ ] [concrete, actionable improvement based on data]
```

Return file path to lead.
