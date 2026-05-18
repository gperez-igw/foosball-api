---
id: sprint-01-retrospective
type: retrospective
sprint: 1
project: foosball-api
created_at: 2026-05-18
---

# Sprint-01 Retrospective — foosball-api

## Context

Sprint-01 delivered the full foosball-api MVP backend (NestJS 11 + Fastify monorepo:
4 apps, 8 libs). The sprint was started on 2026-05-15, paused by the user immediately
after the backend implementers were spawned, and resumed on 2026-05-18 via `/resume`.

## What went well

### Architect
- The pre-sprint specs (api.yaml, schema.sql, test-criteria.md) were complete and
  unambiguous enough that the resume audit found 0 spec gaps in design.
- The `analyze` audit on resume was decisive: it correctly reported ~65% completion
  and an exact per-area delta, which made the implementer re-spawn precise and
  prevented rework.
- Milestone review was fast and clean — full spec compliance, 0 open deviations.

### Backend implementers (api / auth / jobs)
- High-quality, architecturally sound code — the code reviewer found 0 critical issues.
- The cross-area DLQ contract (DlqInspectorService) was agreed up front and both
  sides built against it in parallel with no integration friction.
- Coverage rounds were efficient: the libs went from 53-75% to 86-100% and the
  apps layer from 0% to full controller coverage across two focused rounds.

### Code Reviewer
- Caught a genuine silent functional bug (IMP-04, Redis db-key-space mismatch) that
  no test had surfaced — cache invalidation would have been dead in production.
- The re-review was tightly scoped to the fixes and turned around quickly.

### QA
- Mapped all 7 acceptance scenarios to concrete tests (42/42 e2e sub-cases).
- Correctly blocked the milestone on the coverage DoD rather than waving it through.

## What could improve

### Architect
- The resume RESUME-NOTES (written pre-pause) under-reported actual progress
  ("skeleton only" vs. ~65% done). Progress files should be written before pause,
  not estimated.

### Backend implementers
- The first implementation pass shipped 0 unit tests for the backend-api service
  layer and 0 e2e tests — coverage should be part of the initial Definition of Done,
  not a follow-up round. Two extra coverage rounds were needed.
- IMP-04/IMP-05/IMP-06 (Redis db, audit-log transaction atomicity, confirmation
  race) are correctness issues that ideal first-pass review by the implementer
  would have caught.

### Process
- The sprint ran entirely on `master` with no sprint-01 branch — a branch should be
  cut at sprint start so the PR flow is clean.
- Fix-round and coverage-round changes were left uncommitted until sprint close;
  intermediate commits per round would improve traceability.

## Time breakdown by phase (resume session, 2026-05-18)

| Phase | Notes |
|-------|-------|
| Resume + audit | Architect code-vs-spec audit of 90 existing files |
| Implementation | 3 implementers re-spawned in parallel to close the delta |
| Code review + fix | 1 review, 1 fix round (6 findings), 1 re-review |
| QA | 1 blocked run (coverage) + 2 coverage rounds + final pass |
| Architect review | milestone-01 spec compliance — proceed |
| Documentation | README + docs/API.md + docs/DEPLOYMENT.md |

## Issues encountered and resolution

| Issue | Resolution |
|-------|-----------|
| `@nestjs/config` missing from package.json | PM added the dep + ran `npm install` |
| data-source.ts listed only 2 of 6 migrations/entities | PM completed it |
| `test/auth-sso.e2e-spec.ts` — `request is not a function` | PM fixed supertest import (default vs namespace) |
| IMP-01..06 code review findings | Fix round by backend-api + backend-jobs, PM did the 1-line cross-area Redis db alignment |
| QA blocked: coverage < 80% DoD | Two coverage rounds (libs, then controllers/filters) → 92.48% |

## Suggestions for next sprint

- Cut a dedicated sprint branch at sprint start.
- Treat coverage >= 80% and e2e scenarios as part of the implementer's initial DoD,
  reviewed before the implementer reports milestone-ready.
- Implementers should write the progress file continuously, so a pause/resume has
  accurate state.
- Address the 4 residual tech-debt items (NEW-01 error masking + 3 nitpicks) early.
