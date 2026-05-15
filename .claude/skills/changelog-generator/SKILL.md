---
name: changelog-generator
description: >-
  Generates a structured changelog for PR from sprint artifacts. Use when
  pm needs to produce a stakeholder-readable changelog at sprint end.
  Reads summary, reviews, CRs, and decisions to build CHANGELOG.md.
license: MIT
metadata:
  author: agentflow
  version: "1.0"
  recommended_for: [pm]
---

# Skill: changelog-generator

Generate CHANGELOG.md from sprint artifacts.

## Steps

1. Read `.agentflow/pm/sprints/sprint-XX/summary.md`
2. Read all `.agentflow/architect/reviews/milestone-XX.md` for this sprint
3. Read resolved CRs in `.agentflow/architect/change-requests/`
4. Read `.agentflow/decisions/decision-*.md` for decisions made this sprint

## Output — write to `.agentflow/pm/sprints/sprint-XX/CHANGELOG.md`

```markdown
# Changelog — Sprint XX
Release date: [date]

## New Features
- [Feature]: [what it does for the user]

## Improvements
- [What improved and how]

## Bug Fixes
- [Bug fixed and what was wrong]

## Technical Changes
- [Architectural or structural changes]
- [Schema changes]
- [API changes — mark breaking with BREAKING CHANGE]

## Change Requests Resolved
| CR | Description | Decision |
|----|-------------|----------|

## Deferred to Next Sprint
- [items with reason]

## Breaking Changes
[None / list with migration notes]
```

Return file path to PM.
