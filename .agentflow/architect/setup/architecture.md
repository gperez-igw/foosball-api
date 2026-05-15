---
id: setup-002
type: spec
project: foosball-api
sprint: null
created_by: architect
created_at: 2026-05-15
status: approved
requires_decision: false
---

# Architecture — foosball-api

## System Overview

```
                            ┌─────────────────────────────────────────────────────┐
                            │  Azure AD / Microsoft Identity Platform              │
                            │  (MSAL, token issuer, groups claim)                  │
                            └────────────────────┬────────────────────────────────┘
                                                 │ OAuth2 / OIDC
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│  apps/auth   (NestJS + Fastify)                                                  │
│  ─ MSAL Passport strategy                                                        │
│  ─ /auth/callback endpoint                                                       │
│  ─ JWT issuance (signed with APP_JWT_SECRET)                                     │
│  ─ is_admin sync: groups claim → users.is_admin (DB cache)                       │
│  ─ Graph API fallback when groups claim absent                                   │
└───────────────────────────┬──────────────────────────────────────────────────────┘
                            │ signed JWT
                            ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│  apps/api   (NestJS + Fastify)                                                   │
│  ─ /api/docs → Swagger UI                                                        │
│  ─ JwtAuthGuard (validates JWT, injects user context)                            │
│  ─ RolesGuard (reads is_admin from JWT payload — no DB call on hot path)         │
│  ─ MatchController → MatchService → MatchRepository (TypeORM)                   │
│  ─ LeaderboardController → LeaderboardService → Redis cache                      │
│  ─ Publishes BullMQ events via EventPublisherService (libs/events)               │
└───────────────────────────┬──────────────────────────────────────────────────────┘
                            │ BullMQ events (Redis transport)
                            ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│  apps/worker   (NestJS standalone, no HTTP)                                      │
│  ─ Consumes events from all queues                                               │
│  ─ Retry: 3 attempts, exponential backoff (1s, 5s, 30s)                         │
│  ─ DLQ: failed jobs → dedicated "dlq:{queue-name}" queue                        │
│  ─ Processes: match-confirmed, leaderboard-invalidate, audit-log-write           │
└──────────────────────────────────────────────────────────────────────────────────┘

                                    ┌───────────────────────────────────┐
                                    │  apps/producer   (standalone)      │
                                    │  ─ Scheduled jobs (cron)           │
                                    │  ─ Leaderboard pre-computation      │
                                    │  ─ Publishes via libs/events        │
                                    └───────────────────────────────────┘

            ┌──────────────────────────────────────────────────┐
            │                 libs/                            │
            │  ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
            │  │ common   │ │ database │ │    events      │  │
            │  │ DTOs     │ │ TypeORM  │ │ typed payloads │  │
            │  │ guards   │ │ config   │ │ queue names    │  │
            │  │ pipes    │ │ base-rep │ │ envelope type  │  │
            │  └──────────┘ └──────────┘ └────────────────┘  │
            │  ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
            │  │  auth    │ │  users   │ │    matches     │  │
            │  │  MSAL    │ │ entity   │ │ entity+service │  │
            │  │  JWT     │ │ UserSvc  │ │ quorum logic   │  │
            │  │  guards  │ │ is_admin │ │ audit log      │  │
            │  └──────────┘ └──────────┘ └────────────────┘  │
            │              ┌────────────────┐                  │
            │              │  leaderboard   │                  │
            │              │  queries       │                  │
            │              │  cache layer   │                  │
            │              └────────────────┘                  │
            └──────────────────────────────────────────────────┘

            ┌─────────────────────────────────────────────────┐
            │             Infrastructure                       │
            │  MySQL 8  ←── TypeORM + migrations/             │
            │  Redis 7  ←── BullMQ queues + leaderboard cache │
            └─────────────────────────────────────────────────┘
```

---

## Technology Decisions

### ORM: TypeORM (chosen over Prisma)

**Decision**: TypeORM v0.3.x

**Rationale**:
1. NestJS-first integration: `@nestjs/typeorm` provides first-class support including `TypeOrmModule.forFeature()`, injectable repositories, and decorators (`@Entity`, `@Column`, `@ManyToMany`) that align with NestJS DI.
2. Migration control: TypeORM CLI generates explicit migration files in `migrations/` with UP and DOWN methods — the team maintains full control over schema changes with no auto-apply in production.
3. Decorator-based entities keep entity definition and table schema co-located, reducing the "entity vs Prisma model" cognitive split that would require maintaining two parallel representations.
4. Raw query escape hatch: `QueryBuilder` provides complex query capability for leaderboard aggregations without leaving the ORM context.

**Rejected: Prisma**: Prisma's schema-first approach (separate `schema.prisma`) adds a code-generation step that complicates monorepo multi-app builds. The Prisma Client is generated per schema and does not integrate as cleanly with NestJS module DI as TypeORM's injectable repositories. The migration story (Prisma Migrate) is also more opinionated and harder to control for ordered multi-entity migrations across three parallel implementers.

**Constraint**: `synchronize: false` in ALL environments including development. Schema changes only via versioned migration files.

---

### Web Server: Fastify Adapter (replacing scaffold's Express)

**Decision**: `@nestjs/platform-fastify`

**Rationale**: Briefing explicitly mandates Fastify over Express. Fastify provides lower per-request overhead (important for high-frequency leaderboard reads) and native JSON schema validation via `@fastify/swagger`. The Architect will perform the Express → Fastify swap during setup (before implementers touch `apps/api`).

**Migration plan (setup phase)**:
1. Replace `@nestjs/platform-express` with `@nestjs/platform-fastify` in `package.json`.
2. Update `apps/api/main.ts` to use `NestFastifyApplication`.
3. Remove `@types/express` devDependency; add `@types/node` is sufficient.
4. Update `@nestjs/swagger` usage to use `FastifyAdapter` compatible setup (`SwaggerModule.setup` with Fastify requires `SwaggerCustomOptions` with `useGlobalPrefix`).

---

### Authentication: Azure SSO via MSAL + Local JWT

**Decision**: Two-token architecture

**Flow**:
1. Client redirects to `/auth/login` → `apps/auth` initiates MSAL OAuth2 authorization code flow with Azure AD.
2. Azure AD issues an OIDC token to `/auth/callback`. `apps/auth` validates the token (MSAL `ConfidentialClientApplication`).
3. `apps/auth` reads the `groups` claim from the OIDC token. If present and contains `ADMIN_AZURE_GROUP_ID`, sets `is_admin = true`. Syncs to `users.is_admin` in MySQL (upsert on Azure Object ID).
4. `apps/auth` issues a **short-lived internal JWT** (15 min, signed with `APP_JWT_SECRET`) containing: `sub` (user DB id), `azure_oid` (Azure Object ID), `email`, `is_admin` (boolean). Returns refresh token (24h, stored in `refresh_tokens` table).
5. All `apps/api` endpoints validate the internal JWT via `JwtAuthGuard` (no Azure AD call on hot path). `is_admin` read from JWT payload.

**Groups claim caps (R3)**:
- Azure AD includes the `groups` claim in tokens only when the user belongs to **150 or fewer groups** (security token) or **200 or fewer groups** (access token). For users exceeding these limits, Azure AD omits the `groups` claim entirely and includes a `_claim_names` / `_claim_sources` hint.
- **Mitigation**: `apps/auth` detects the absent `groups` claim via presence of `_claim_names.groups` in the token payload. When detected, it falls back to a Microsoft Graph API call: `GET https://graph.microsoft.com/v1.0/me/memberOf?$select=id` using the user's delegated access token. This requires the `GroupMember.Read.All` (or `Directory.Read.All`) permission granted to the Azure App Registration.
- The fallback is implemented in `libs/auth/src/graph-groups.service.ts` and is transparent to consumers.

**Required Azure App Registration configuration** (documented in README):
- Token configuration → Add groups claim → All groups (or "Groups assigned to the application")
- API permissions: `GroupMember.Read.All` (or `Directory.Read.All`) — required for Graph API fallback
- Reply URLs: must include `/auth/callback`

---

### BullMQ: Typed Events, Retry, DLQ

**Decision**: All inter-service communication is asynchronous via BullMQ. No HTTP calls between apps.

**Event contract location**: `libs/events/src/`

```
libs/events/src/
├── index.ts                    # barrel export
├── queue-names.ts              # constants: QUEUE_MATCHES, QUEUE_LEADERBOARD, QUEUE_AUDIT
├── event-envelope.ts           # EventEnvelope<T> wrapper type
├── payloads/
│   ├── match-confirmed.payload.ts
│   ├── match-cancelled.payload.ts
│   ├── leaderboard-invalidate.payload.ts
│   └── audit-log.payload.ts
```

**EventEnvelope type** (in `event-envelope.ts`):
```typescript
export interface EventEnvelope<T> {
  eventType: string;       // e.g. 'match.confirmed'
  version: number;         // starts at 1, increment on breaking change
  occurredAt: string;      // ISO-8601
  payload: T;
}
```

**Versioning strategy**: If a breaking payload change is needed, increment `version` in the envelope. The consumer checks the version field and handles both old and new shapes during migration windows. Consumer must always check `version` before destructuring payload. Deprecated versions are removed only after all producers have migrated (coordinated via PM).

**Queue configuration** (in `libs/events/src/queue-config.ts`):
```typescript
export const defaultJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,   // 1s, 5s, 30s
  },
  removeOnComplete: { age: 86400 },   // 24h
  removeOnFail: false,                // keep in DLQ
};
```

**DLQ**: Failed jobs (exhausted retries) remain in their queue with `failedReason`. A separate processor in `apps/worker` subscribes to the `failed` event of each queue and re-enqueues into a `dlq:{original-queue-name}` queue for manual inspection. An admin endpoint in `apps/api` (`GET /admin/dlq`, `POST /admin/dlq/:jobId/retry`) allows operators to inspect and retry DLQ jobs.

---

### Migrations Strategy

**Decision**: TypeORM CLI migrations, stored in `migrations/`, executed at startup.

**Rules**:
1. Migrations are generated by each implementer for their entities: `npx typeorm migration:generate migrations/<name> -d dist/libs/database/src/data-source.js`
2. All migration files are committed to the repo. No auto-generated naming collisions: each implementer prefixes with their area (e.g., `1234567890000-AddUsersTable`, `1234567890001-AddMatchesTable`).
3. Production startup runs `dataSource.runMigrations()` before accepting traffic.
4. `synchronize: false` — enforced via TypeORM config.
5. Migration file ordering: timestamps are auto-generated; if two implementers generate migrations simultaneously, the PM assigns sequential timestamps before merge.

---

### Audit Log Model

**Decision**: Separate `audit_logs` table — append-only.

**Rationale**: Admin overrides of confirmed match results must be permanently traceable. An append-only log in a dedicated table provides:
- Immutability: no UPDATE or DELETE on `audit_logs` (enforced at application layer; no FK delete cascades to this table).
- Separation: audit records are not modified when match data changes.
- Query isolation: audit queries never compete with match or leaderboard queries.

**Schema** (in `libs/matches/src/entities/audit-log.entity.ts`):
```sql
-- preview (full schema in schema.sql, Phase 3)
CREATE TABLE audit_logs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_type VARCHAR(64)  NOT NULL,    -- 'match'
  entity_id   BIGINT UNSIGNED NOT NULL, -- FK (soft, no cascade) to matches.id
  action      VARCHAR(64)  NOT NULL,    -- 'result_override', 'match_delete'
  actor_id    BIGINT UNSIGNED NOT NULL, -- FK to users.id
  before_data JSON         NOT NULL,    -- snapshot of changed fields before
  after_data  JSON         NOT NULL,    -- snapshot of changed fields after
  reason      TEXT,                     -- optional admin note
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_actor (actor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Important**: The FK from `audit_logs.entity_id` to `matches.id` is a **soft reference** (no physical FK constraint). This ensures that if a match is deleted by an admin, the audit trail is preserved. Physical FK constraint would complicate the audit record lifecycle.

---

## Testing

**Test framework**: Jest v30 (already present in scaffold)

**Dependencies** (additions to existing devDependencies):
```
@nestjs/testing  (already present)
supertest         (already present)
```
Additional test deps to be added per implementer needs:
```
jest-mock-extended   -- typed mocks for TypeORM repositories
ioredis-mock         -- Redis mock for unit tests without Redis instance
```

**Test script** (`package.json`):
```json
"test": "jest",
"test:cov": "jest --coverage",
"test:e2e": "jest --config ./test/jest-e2e.json"
```

**Jest configuration** (existing `jest` block in `package.json` will be updated for monorepo):
```json
{
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "roots": ["<rootDir>/apps", "<rootDir>/libs"],
    "testRegex": ".*\\.spec\\.ts$",
    "transform": { "^.+\\.(t|j)s$": "ts-jest" },
    "collectCoverageFrom": ["apps/**/*.(t|j)s", "libs/**/*.(t|j)s"],
    "coverageDirectory": "./coverage",
    "testEnvironment": "node",
    "moduleNameMapper": {
      "@app/common/(.*)": "<rootDir>/libs/common/src/$1",
      "@app/database/(.*)": "<rootDir>/libs/database/src/$1",
      "@app/events/(.*)": "<rootDir>/libs/events/src/$1",
      "@app/matches/(.*)": "<rootDir>/libs/matches/src/$1",
      "@app/leaderboard/(.*)": "<rootDir>/libs/leaderboard/src/$1",
      "@app/auth/(.*)": "<rootDir>/libs/auth/src/$1",
      "@app/users/(.*)": "<rootDir>/libs/users/src/$1"
    }
  }
}
```

**Directory structure**:
- Unit tests: colocated as `*.spec.ts` in the same directory as the source file
  - e.g., `libs/matches/src/match.service.spec.ts`
  - e.g., `libs/auth/src/msal.strategy.spec.ts`
- E2E tests: `test/` in root, one file per major flow
  - e.g., `test/match-confirmation.e2e-spec.ts`

**Naming conventions**:
- Unit test files: `{ClassName}.spec.ts` (e.g., `MatchService.spec.ts`)
- E2E test files: `{flow-name}.e2e-spec.ts` (e.g., `match-confirmation.e2e-spec.ts`)

**Coverage target**: ≥ 80% statement coverage on `libs/matches/`, `libs/leaderboard/`, `libs/auth/`, `libs/users/`.

---

## Security Architecture

### Per-endpoint auth requirements

| Area | Default | Override |
|---|---|---|
| `apps/auth` routes (`/auth/*`) | Public (MSAL callback) | — |
| `apps/api` all routes | `JwtAuthGuard` (authenticated) | Explicit `@Public()` decorator |
| `apps/api` `/admin/*` routes | `JwtAuthGuard` + `RolesGuard(is_admin=true)` | — |
| `apps/api` `/api/docs` | Public (Swagger UI) | — |

### Input validation

- All DTOs use `class-validator` + `class-transformer` via NestJS `ValidationPipe` (global, `whitelist: true`, `forbidNonWhitelisted: true`).
- Field-level constraints specified in Phase 3 api.yaml.
- SQL injection: mitigated by TypeORM parameterized queries; no raw string interpolation in QueryBuilder.

### Secrets handling

All secrets in environment variables. Never hardcoded. See `.env.example` for the complete list.

### Rate limiting

`@nestjs/throttler` (Fastify-compatible) applied globally:
- Default: 100 requests / 60 seconds per IP
- `/auth/*`: 10 requests / 60 seconds per IP (brute-force protection)
- Override per endpoint via `@Throttle()` decorator

### Session / token strategy

- No server-side session state: stateless JWT (15 min expiry)
- Refresh token: stored in `refresh_tokens` table (24h expiry), single-use (rotated on refresh)
- Token rotation on refresh: old refresh token invalidated, new one issued
- Redis is NOT used for session storage — only for BullMQ and leaderboard cache

### CORS

- Allowed origins: configured via `CORS_ORIGINS` env var (comma-separated). Default empty (API-only, no browser origins needed initially).
- Fastify CORS: `@fastify/cors` with explicit `origin` list.

---

## Performance Architecture

### Pagination

- Cursor-based pagination for all list endpoints (no SQL OFFSET).
- Cursor = encoded `created_at` + `id` pair (opaque to client).
- `LIMIT` default: 20 records, max: 100.

### Caching

- Leaderboard responses cached in Redis (TTL: 5 minutes for real-time; 1 hour for historical filters).
- Cache invalidation: when a match is confirmed, a `leaderboard-invalidate` BullMQ event is published; the worker clears the relevant Redis keys.
- Cache key format: `leaderboard:{type}:{filter}` (e.g., `leaderboard:users:week`).

### Database indexes

Critical indexes (will be formalized in schema.sql, Phase 3):
- `matches`: composite index on `(status, created_at)` for status-filtered pagination
- `match_players`: index on `(match_id)`, index on `(user_id)` for join performance
- `confirmations`: unique index on `(match_id, user_id)` to prevent duplicate confirmations
- `users`: unique index on `azure_oid` for O(1) SSO upsert
- `audit_logs`: composite index on `(entity_type, entity_id)` for audit trail queries

### Bundle / build targets

- Each app builds independently via NestJS CLI: `nest build api`, `nest build auth`, etc.
- No frontend bundle — API only.

---

## Error Handling

### API error format

```json
{
  "error": {
    "code": "MATCH_ALREADY_CONFIRMED",
    "message": "Cannot modify a confirmed match",
    "details": {
      "matchId": 42,
      "status": "confirmed"
    }
  }
}
```

All errors follow this envelope. `code` is a machine-readable constant (screaming snake case). HTTP status codes follow REST conventions (409 for conflict, 403 for forbidden, etc.).

### Frontend error boundary

Not applicable (API-only project).

### Retry policy

- BullMQ jobs: 3 attempts, exponential backoff (see Retry/DLQ section above).
- Graph API fallback: single retry with 500ms delay; if still failing, return 503 with `AZURE_GRAPH_UNAVAILABLE` error code.

### Graceful degradation

- If Redis is down: leaderboard queries fall back to direct MySQL reads (cache bypass). A warning is logged but the API does not return an error.
- If BullMQ is down: `apps/api` logs the failure and returns a 202 with `{ "warning": "event_queued_failed" }` for non-critical events (leaderboard invalidation). For critical events (audit log), returns 500 — the calling operation is rolled back.

### Logging

- Library: `@nestjs/common` Logger (structured, JSON output in production via `nest-winston` wrapper).
- Levels: `error` (always logged), `warn` (BullMQ partial failures, cache misses), `log` (request lifecycle in dev), `debug` (disabled in production).
- What is logged: every BullMQ job dispatch (queue, jobId, eventType, version), every auth event (login, token refresh, role sync), every admin override (actor, entity, before/after).

---

## Dependency Manifest (initial setup)

### dependencies (runtime)

| Package | Version | Purpose |
|---|---|---|
| `@nestjs/common` | ^11.0.1 | NestJS core |
| `@nestjs/core` | ^11.0.1 | NestJS core |
| `@nestjs/platform-fastify` | ^11.0.1 | Fastify adapter (replaces Express) |
| `@nestjs/typeorm` | ^11.0.0 | TypeORM integration |
| `@nestjs/bullmq` | ^11.0.0 | BullMQ integration |
| `@nestjs/jwt` | ^11.0.0 | JWT issuance/validation |
| `@nestjs/passport` | ^11.0.0 | Passport integration |
| `@nestjs/swagger` | ^11.0.0 | Swagger/OpenAPI UI |
| `@nestjs/throttler` | ^6.0.0 | Rate limiting |
| `@nestjs/schedule` | ^5.0.0 | Cron jobs in producer |
| `@microsoft/microsoft-graph-client` | ^3.0.0 | Graph API fallback |
| `passport` | ^0.7.0 | Auth middleware |
| `passport-azure-ad` | ^4.3.5 | Azure AD strategy (MSAL) |
| `@azure/msal-node` | ^2.0.0 | MSAL Node client |
| `typeorm` | ^0.3.20 | ORM |
| `mysql2` | ^3.0.0 | MySQL driver |
| `bullmq` | ^5.0.0 | Queue library |
| `ioredis` | ^5.0.0 | Redis client |
| `class-validator` | ^0.14.0 | DTO validation |
| `class-transformer` | ^0.5.0 | DTO serialization |
| `rxjs` | ^7.8.1 | NestJS observables |
| `reflect-metadata` | ^0.2.2 | Decorator support |

### devDependencies (additions to scaffold)

| Package | Version | Purpose |
|---|---|---|
| `jest-mock-extended` | ^3.0.0 | Typed mock factories for TypeORM repos |
| `ioredis-mock` | ^8.0.0 | Redis mock for unit tests |
| `@types/passport` | ^1.0.0 | TypeScript types |
| `@types/passport-azure-ad` | ^4.0.0 | TypeScript types |

### Removed from scaffold

- `@nestjs/platform-express` (replaced by Fastify adapter)
- `@types/express` (no longer needed)

---

## Codebase Analysis (existing scaffold)

### Tech Stack (detected)

- Backend: NestJS 11, TypeScript 5.7, Node.js
- Database: none configured yet (MySQL target per briefing)
- Infrastructure: none (docker-compose not present)

### Current State

- Flat `src/` structure: `app.module.ts` (empty module), `main.ts` (Express-based bootstrap)
- Test: single e2e spec (`test/app.e2e-spec.ts`) testing a non-existent `Hello World` endpoint
- No controllers, services, guards, DTOs — scaffold only
- Package manager: npm (package-lock.json present)
- TypeScript config: `module: nodenext`, `moduleResolution: nodenext` — requires `.js` extension in imports or path aliases

### Migration to Monorepo — Architect Responsibility (setup phase)

The following changes are made by the Architect during setup (before sprint-01 implementers start):

1. **`nest-cli.json`** — add `monorepo: true`, `projects` array with all 4 apps
2. **Root `package.json`** — replace `@nestjs/platform-express` with `@nestjs/platform-fastify`; add all dependencies listed above; update Jest config for monorepo roots and `moduleNameMapper`
3. **Directory scaffold** — create empty app entrypoints and lib index files:
   - `apps/api/src/main.ts`, `apps/api/src/app.module.ts`
   - `apps/auth/src/main.ts`, `apps/auth/src/app.module.ts`
   - `apps/worker/src/main.ts`, `apps/worker/src/app.module.ts`
   - `apps/producer/src/main.ts`, `apps/producer/src/app.module.ts`
   - `libs/{common,database,events,matches,leaderboard,auth,users}/src/index.ts`
4. **Remove old `src/`** — after scaffold is in place, `src/` is archived into `apps/api/` (it becomes the API app); only `app.module.ts` and `main.ts` are replaced with Fastify-aware versions
5. **`tsconfig.json`** — add `paths` aliases for all libs
6. **`docker-compose.yml`** — create with MySQL 8 + Redis 7
7. **`.env.example`** — create with all required variables
8. **`migrations/` directory** — create with `.gitkeep`

Note: The Architect does NOT implement business logic during setup — only creates the structural skeleton that implementers fill in.

### Constraints from existing code

- TypeScript `module: nodenext` with `moduleResolution: nodenext`: NestJS monorepo path aliases (`@app/common`) are defined in `tsconfig.json` `paths` and resolved via `tsconfig-paths` at runtime. These must use the pattern `@app/{lib-name}`.
- `noImplicitAny: false` is already set — implementers should be aware.
- ESLint config uses `projectService: true` for type-aware linting — all lib `tsconfig.json` files must be referenced.

### Draft Specs Generated

- api.yaml: NO — generated in Phase 3 (specs mode, sprint-01)
- schema.sql: NO — generated in Phase 3 (specs mode, sprint-01)
- ui-components.md: NO — API-only project, not applicable
