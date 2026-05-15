---
name: context-loader
description: >-
  Checklist for the lead when spawning teammates. Ensures the right context
  is included in each spawn prompt so teammates have what they need without
  being overwhelmed with irrelevant history. Use this skill to determine
  what to include per role and phase.
license: MIT
metadata:
  author: agentflow
  version: "2.0"
  recommended_for: [pm, designer, prototyper, architect, frontend, backend, code-reviewer, qa]
---

# Skill: context-loader

Use this checklist when crafting spawn prompts for teammates. Include only what is relevant to the teammate's role and current phase.

## Context by Role

### Lead (PM) — self-reference
- Current sprint plan: `.agentflow/pm/sprints/sprint-XX/plan.md`
- Backlog priorities: `.agentflow/pm/backlog.md` (P0/P1 items)
- Latest architect reviews: `.agentflow/architect/reviews/` (most recent)
- All teams' progress status: `.agentflow/teams/*/progress.md` (status field)
- Open decisions: any pending decisions from the current session

### Designer
- Project briefing summary (from setup)
- Design system: `.agentflow/designer/system.md`
- Sprint plan section relevant to design: tasks tagged with `design` label
- Reference files: `.agentflow/references/` (design philosophy, frontend patterns)
- Existing wireframes if iteration: `.agentflow/designer/wireframes.md`

### Reviewer (Architect)
- All specs: `.agentflow/architect/specs/` (api.yaml, schema.sql, ui-components.md, test-criteria.md)
- Teams setup: `.agentflow/architect/setup/teams.md`
- Current sprint plan: relevant milestones and tasks
- Previous reviews (if any): `.agentflow/architect/reviews/`
- All teams' progress and bugs: `.agentflow/teams/*/progress.md`, `.agentflow/teams/*/shared/bugs.md`

### Implementer (Frontend / Backend)
- Relevant spec section only (filter by team scope):
  - Frontend: `ui-components.md`, frontend endpoints from `api.yaml`
  - Backend: `schema.sql`, backend endpoints from `api.yaml`
- Sprint tasks assigned to this team: from `.agentflow/pm/sprints/sprint-XX/plan.md`
- Team assignment and scope: from `.agentflow/architect/setup/teams.md`
- Current bugs assigned to this team: `.agentflow/teams/[team]/shared/bugs.md`
- Any active guidance from architect: `.agentflow/architect/guidance/`

### QA
- Test criteria: `.agentflow/architect/specs/test-criteria.md`
- Sprint plan milestones for this test run
- All teams' progress (what has been implemented): `.agentflow/teams/*/progress.md`
- Existing bugs: `.agentflow/teams/*/shared/bugs.md`
- Previous QA reports (if any): `.agentflow/teams/*/qa/report.md`

## What to EXCLUDE from spawn prompts

- Full decision history (summarize instead)
- Specs for other teams (frontend doesn't need backend schema and vice versa)
- Previous sprint artifacts (unless specifically relevant to current task)
- Full trace logs or execution history
- Files unrelated to the assigned task

## Format for inclusion in spawn prompt

```
## Context

### Current phase
Sprint [XX], [phase: setup|implementation|review|wrap-up]

### Your assignment
[specific task description]

### Relevant files to read
- [file path]: [why it's relevant]
- [file path]: [why it's relevant]

### Key constraints
- [constraint from spec or previous decision]
- [team boundary or scope limitation]
```

## Output

No file output — this skill informs the lead's spawn prompt composition.
