---
id: sprint-01-summary
type: sprint-summary
sprint: 1
project: foosball-api
status: complete
created_at: 2026-05-18
---

# Sprint-01 Summary — foosball-api MVP

## Goal

Deliver the complete foosball-api MVP backend per the briefing Definition of Done:
a NestJS 11 + Fastify monorepo with Azure SSO, match CRUD with quorum confirmation
and post-confirmation immutability, user/pair leaderboards, typed BullMQ events, and
a tested, documented, build-green codebase.

## Outcome: COMPLETE

All sprint-01 milestones (M1-M4) delivered. QA milestone gate PASS. Architect
milestone review verdict: proceed.

## Delivered

- **Monorepo** — 4 NestJS apps (`api`, `auth`, `worker`, `producer`) + 8 libs
  (matches, leaderboard, auth, users, events, common, database, jobs).
- **Auth** — Azure AD SSO via MSAL, internal JWT (15 min) + single-use refresh
  tokens in MySQL, admin/user roles from the `groups` claim with Graph API fallback,
  JwtAuthGuard global, RolesGuard on admin routes.
- **Match domain** — CRUD for 1v1/2v2/4v4 matches, player slots, result submission,
  quorum confirmation (`floor(n/2)+1`), post-confirmation immutability, creator
  cancel, admin override with transactional audit log.
- **Leaderboard** — user and pair rankings with week/month/year/total filters,
  Redis cache with TTL + bypass fallback, draw = 0 wins.
- **Jobs** — typed BullMQ EventEnvelope payloads, producer cron, worker consumers
  with version check, retry (3 attempts, exponential backoff) and DLQ; DLQ
  inspection/retry exposed via admin endpoints.
- **Quality** — 22 REST endpoints, Swagger, 320 unit + 42 e2e tests, 92.48%
  statement coverage.
- **Docs** — README.md, docs/API.md, docs/DEPLOYMENT.md.

## Quality gates

| Gate | Result |
|------|--------|
| Build (4 apps) | PASS |
| Unit tests | 320 / 320 PASS (31 suites) |
| E2E tests | 42 / 42 PASS (8 suites) |
| Statement coverage | 92.48% overall (libs 93-100%) — DoD >= 80% met |
| Acceptance scenarios | 7 / 7 covered |
| Code review | Approved (6 major findings fixed + re-reviewed) |
| Architect milestone review | proceed — 0 open spec deviations |

## Decisions during the sprint

- 2026-05-18: Resume strategy — Architect audit first, then targeted implementer
  re-spawn (decision-2026-05-18-0834-resume-audit-first.md).

## Residual tech debt (non-blocking)

- NEW-01: `admin-override.service.ts` catch block masks the original error before
  throwing a generic `AUDIT_LOG_WRITE_FAILED` — log the original error first.
- NIT-01: `console.log` in bootstrap functions — use the Nest `Logger`.
- NIT-02: `MatchEntity` `@OneToMany` relations typed as `any[]`.
- NIT-04: `ListMatchesDto.cursor` has no `@MaxLength`.

## Notes

- The sprint ran on `master` with no dedicated sprint branch.
- The two audit-flagged gaps (BullMQ publish wiring, AuditLogProcessor DB write)
  and all 6 code-review findings were fully resolved and re-verified.
