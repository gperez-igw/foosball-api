---
id: setup-001
type: setup
project: foosball-api
sprint: null
created_by: architect
created_at: 2026-05-15
status: approved
requires_decision: false
---

# Team Structure — foosball-api

## Monorepo Layout

```
foosball-api/
├── apps/
│   ├── api/                    # HTTP REST entrypoint (Fastify)
│   ├── auth/                   # Azure SSO entrypoint + token validation
│   ├── worker/                 # BullMQ consumer (job execution)
│   └── producer/               # BullMQ publisher (event producer)
├── libs/
│   ├── common/                 # Shared DTOs, decorators, guards, pipes, utils
│   ├── database/               # TypeORM DataSource config, base repository, migrations runner
│   ├── events/                 # BullMQ typed event contracts (payload types + queue names)
│   ├── matches/                # Match domain: entities, services, repositories, business logic
│   ├── leaderboard/            # Leaderboard domain: queries, aggregations, cache layer
│   ├── auth/                   # MSAL strategy, JWT guard, roles guard, token parsing
│   └── users/                  # User entity, user service, is_admin sync logic
├── migrations/                 # Versioned TypeORM migration files (idempotent)
├── docker-compose.yml          # Local dev: MySQL 8 + Redis 7
├── .env.example                # All required env vars (no secrets)
├── nest-cli.json               # Monorepo projects array
├── tsconfig.json               # Root compiler options
├── tsconfig.build.json         # Excludes tests from build
├── package.json                # Root package.json (workspace root)
└── README.md
```

## Team Members

### backend-api

**Role**: HTTP layer implementer — REST endpoints, request validation, Swagger documentation, Fastify adapter setup.

**Owns exclusively**:
- `apps/api/` — all files under this path
- `libs/matches/` — Match entity, MatchService, MatchRepository, confirmation quorum logic, audit log entity
- `libs/leaderboard/` — Leaderboard queries (users, pairs), time-filter logic, Redis cache integration

**Must NOT touch**:
- `apps/auth/`, `apps/worker/`, `apps/producer/`
- `libs/auth/`, `libs/users/`, `libs/events/`
- `libs/common/` (read-only; request changes via PM)
- `libs/database/` (read-only; request changes via PM)
- Root config files (read-only)

**Shared files (read-only, changes via PM)**:
- `libs/common/` — can import but not modify
- `libs/database/` — can import DataSource but not modify config
- `libs/events/` — consumes event type definitions; publishing is backend-jobs territory

---

### backend-auth

**Role**: Authentication and identity implementer — Azure SSO integration, MSAL strategy, JWT validation, role sync to DB.

**Owns exclusively**:
- `apps/auth/` — all files under this path
- `libs/auth/` — MsalStrategy, JwtAuthGuard, RolesGuard, AzureAdService, token parsing utilities
- `libs/users/` — User entity, UserService, UserRepository, is_admin sync logic, user profile update

**Must NOT touch**:
- `apps/api/`, `apps/worker/`, `apps/producer/`
- `libs/matches/`, `libs/leaderboard/`, `libs/events/`
- `libs/common/` (read-only; request changes via PM)
- `libs/database/` (read-only; request changes via PM)
- Root config files (read-only)

**Shared files (read-only, changes via PM)**:
- `libs/common/` — may import decorators, pipes, guards base classes
- `libs/database/` — may import DataSource, TypeORM config

---

### backend-jobs

**Role**: Async layer implementer — BullMQ queue definitions, event publishing, job processors, retry/DLQ configuration.

**Owns exclusively**:
- `apps/worker/` — BullMQ consumer app entrypoint, processor registration
- `apps/producer/` — BullMQ producer app entrypoint, event publishing services
- `libs/events/` — typed event payload interfaces, queue name constants, event envelope type

**Must NOT touch**:
- `apps/api/`, `apps/auth/`
- `libs/matches/`, `libs/leaderboard/`, `libs/auth/`, `libs/users/`
- `libs/common/` (read-only; request changes via PM)
- `libs/database/` (read-only; request changes via PM)
- Root config files (read-only)

**Shared files (read-only, changes via PM)**:
- `libs/common/` — may import shared types and utilities
- `libs/database/` — worker may need DB access for job persistence (import only)

---

### backend-reviewer

**Role**: Code Reviewer — no file write area. Reviews PRs from the three implementers.

**Owns exclusively**: none (reviewer role only)

**Review focus**:
- Spec compliance (api.yaml, schema.sql, architecture.md)
- TypeScript strict mode adherence
- Security: auth guards on all non-public endpoints, input validation, no hardcoded secrets
- BullMQ patterns: retry config, DLQ handler, typed payloads
- TypeORM: migration-first (no `synchronize: true`), proper indexes, correct FK cascade
- Test coverage: unit + e2e per DoD requirements (≥ 80% statement coverage)

---

## Shared File Ownership

| File/Directory | Owner | Protocol during sprint |
|---|---|---|
| `package.json` | Architect (setup) | Sprint: first implementer needing a new dep requests via PM |
| `nest-cli.json` | Architect (setup) | Sprint: only Architect modifies; request via PM |
| `tsconfig.json` | Architect (setup) | Sprint: only Architect modifies; request via PM |
| `tsconfig.build.json` | Architect (setup) | Sprint: only Architect modifies |
| `docker-compose.yml` | Architect (setup) | Sprint: PM mediates conflicts |
| `.env.example` | Architect (setup) | Sprint: each team adds its own vars; PM merges |
| `libs/common/` | Architect (setup) | Sprint: implementers propose additions via PM |
| `libs/database/` | Architect (setup) | Sprint: only Architect adds TypeORM migrations base config; backend-api owns entity registration |
| `migrations/` | backend-api + Architect | Migration files: each implementer generates for their entities; Architect reviews for ordering |

---

## Split Rationale

### Criterion 1 — Domain Cohesion

Three distinct business domains map cleanly to three implementers:

1. **HTTP + Business Logic** (backend-api): The `api` app and the two business domains (`matches`, `leaderboard`) are tightly coupled — controllers reference services which reference repositories and entities. Splitting `matches` from `api` would require constant cross-team coordination on every endpoint. Keeping both in one owner eliminates that coupling at zero coordination cost.

2. **Identity + Security** (backend-auth): Authentication is a standalone concern. The MSAL strategy, JWT guard, and user sync logic form a self-contained module with no runtime dependency on match or leaderboard logic. The `auth` app and its libs have a single external dependency: `libs/common` (for guards base) and `libs/database` (for user persistence). No circular dependency.

3. **Async Infrastructure** (backend-jobs): BullMQ producers, workers, and event type contracts form a horizontal concern shared by all apps. Keeping the event type definitions (`libs/events/`) with the jobs owner ensures that the producer and consumer of each event type are always owned by the same agent — eliminating the producer/consumer drift risk (R2).

### Criterion 2 — Coupling (Shared File Footprint)

The three implementers share only:
- `libs/common/` — read-only import (guards, DTOs, decorators)
- `libs/database/` — read-only import (TypeORM DataSource, base repository)

No implementer needs to write to another implementer's area during normal sprint execution. The PM mediates the rare exception (e.g., backend-api needing a new field in `libs/common`).

### Criterion 3 — Parallel Execution

The three areas can execute in parallel once the shared foundation (`libs/common`, `libs/database`, `libs/events` skeleton) is scaffolded by the Architect in setup. backend-auth and backend-jobs have no runtime dependency on each other. backend-api depends on event types from `libs/events` but only consumes them (publishes events using the types defined by backend-jobs) — this dependency is satisfied by a thin interface file that backend-jobs commits first.

### Why this differs from the briefing's indicative split

The briefing's `apps/producer/` was assigned to backend-jobs (same as here). The main deviation is explicit: `libs/events/` ownership moves from "unspecified shared" to backend-jobs, because the producer and the event type contract must be co-owned. A drift where backend-api defines payload types and backend-jobs defines queue names would cause type-unsafe consumption in the worker.

---

## Dependency Graph (sprint execution order)

```
Architect setup
    └── libs/common skeleton + libs/database config + libs/events skeleton
            ├── backend-auth: libs/auth, libs/users, apps/auth  (no deps on other implementers)
            ├── backend-jobs: fills libs/events types, apps/worker, apps/producer  (depends on libs/events skeleton only)
            └── backend-api: libs/matches, libs/leaderboard, apps/api  (depends on libs/events for publishing, libs/auth for guards)
                    └── (soft dep) backend-auth completes JwtAuthGuard before backend-api wires auth middleware
```

Architect scaffolds the foundation before implementers start. Backend-auth and backend-jobs can start simultaneously. Backend-api starts after backend-auth delivers the auth guard (or uses a stub guard during development).
