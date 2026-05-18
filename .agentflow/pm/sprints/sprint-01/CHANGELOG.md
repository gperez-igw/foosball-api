# Changelog — Sprint-01

All notable changes delivered in sprint-01 of foosball-api.

## [sprint-01] — 2026-05-18

### Added

- Monorepo scaffold: 4 NestJS 11 + Fastify apps (`api`, `auth`, `worker`,
  `producer`) and 8 shared libs.
- Azure AD SSO authentication (MSAL): login/callback, internal JWT (15 min),
  single-use refresh tokens persisted in MySQL, logout.
- Role authorization: admin/user derived from the AD `groups` claim with Microsoft
  Graph API fallback when the claim exceeds the cap; `JwtAuthGuard` applied globally,
  `RolesGuard` on admin routes.
- Match domain: create/list/get/update/delete matches (1v1, 2v2, 4v4), player slot
  assignment, result submission.
- Quorum confirmation flow: `floor(n/2)+1` confirmations lock the result;
  post-confirmation immutability; creator can cancel confirmation before quorum.
- Admin result override with a transactional, append-only audit log.
- Leaderboards: user and pair rankings with week/month/year/total filters, Redis
  cache (TTL + bypass fallback); draws count as 0 wins.
- Typed BullMQ event pipeline: `EventEnvelope<T>` payloads, producer cron, worker
  consumers with version check, retry (3 attempts, exponential backoff) and DLQ;
  admin DLQ inspection and retry endpoints.
- Swagger API documentation; project README, API reference, and deployment guide.
- Test suite: 320 unit tests + 42 e2e tests; 92.48% statement coverage.
- TypeORM migrations 001-006 for all 6 tables.

### Fixed

- `POST /matches` now returns HTTP 201.
- BullMQ event publishing wired into the match domain (was missing): result
  submitted, confirmed, confirmation cancelled, admin override + leaderboard
  invalidation.
- `AuditLogProcessor` now persists audit rows to the database (was a log-only stub).
- Redis key-space alignment: worker and leaderboard service now use the same
  database, so cache invalidation works.
- Admin override audit log written inside the DB transaction (atomic rollback).
- Confirmation flow guarded by a row-level lock to prevent duplicate
  `match.confirmed` events under concurrency.
- `POST /admin/dlq/:jobId/retry` now requires an explicit `queue` parameter.
- BullMQ retry default corrected to 3 attempts per spec.
- `apps/auth` global guard corrected from `ThrottlerGuard` to `JwtAuthGuard`.
- `data-source.ts` completed with all 6 migrations and entities.
- `@nestjs/config` added as a dependency.
