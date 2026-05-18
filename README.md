# foosball-api

REST API for recording and tracking company foosball (table football) match results. Built on NestJS 11 + Fastify as a monorepo of four independent processes, with Azure AD SSO, quorum-based result confirmation, time-filtered leaderboards, BullMQ async jobs, MySQL 8 persistence, and Redis 7 caching.

---

## What is this

foosball-api is an internal company API that lets employees register foosball match results, confirm them via a quorum mechanism (a majority of players must accept), and browse win-based leaderboards filtered by time period. Match results become immutable once the confirmation quorum is reached. Administrators can override confirmed results; every override is recorded in an append-only audit log. An Azure AD group controls which users receive admin privileges.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 20 LTS or later |
| npm | 10 or later |
| Docker + Docker Compose | any recent version |
| Azure App Registration | with redirect URI and groups claim configured (see Azure AD Configuration) |

---

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd foosball-api
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env — all required variables are documented in the Environment Variables section
```

### 3. Start infrastructure (MySQL 8 + Redis 7)

```bash
docker compose up -d
```

MySQL will be available on port 3306 and Redis on port 6379.
Wait for both healthchecks to pass before running migrations (`docker compose ps`).

### 4. Run database migrations

Migrations must be compiled before they can run:

```bash
npm run build
npm run migration:run
```

This applies all six migrations in order:
1. `AddUsersTable`
2. `AddRefreshTokensTable`
3. `AddMatchesTable`
4. `AddMatchPlayersTable`
5. `AddMatchConfirmationsTable`
6. `AddAuditLogsTable`

### 5. Start the application processes

Each of the four apps is a separate NestJS process. Open a terminal per process:

```bash
# HTTP REST API — port 3000
npm run start:api

# Azure SSO handler — port 3001
npm run start:auth

# BullMQ job consumer (optional in local dev but needed for quorum events)
npm run start:worker

# BullMQ cron publisher (optional in local dev)
npm run start:producer
```

### 6. Access Swagger UI

```
http://localhost:3000/api/docs
```

---

## Available Commands

| Command | Description |
|---|---|
| `npm run start:api` | Start API app in watch mode (port 3000) |
| `npm run start:auth` | Start auth app in watch mode (port 3001) |
| `npm run start:worker` | Start worker app in watch mode (no HTTP) |
| `npm run start:producer` | Start producer app in watch mode (no HTTP) |
| `npm run build` | Build all four apps |
| `npm run build:api` | Build API app only |
| `npm run build:auth` | Build auth app only |
| `npm run build:worker` | Build worker app only |
| `npm run build:producer` | Build producer app only |
| `npm test` | Run all unit tests (Jest) |
| `npm run test:cov` | Run unit tests with coverage report |
| `npm run test:e2e` | Run end-to-end test suite |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run lint` | Lint all TypeScript files with ESLint (auto-fix) |
| `npm run format` | Format all TypeScript files with Prettier |
| `npm run migration:run` | Apply pending TypeORM migrations |
| `npm run migration:revert` | Revert the last TypeORM migration |
| `npm run migration:generate <name>` | Generate a new migration from entity changes |

> **Note:** `migration:generate` and `migration:run` operate on the compiled DataSource at `dist/libs/database/src/data-source.js`. Run `npm run build` before using them.

---

## Project Structure

```
foosball-api/
├── apps/
│   ├── api/                    # HTTP REST server (Fastify, port 3000)
│   │   └── src/
│   │       ├── controllers/    # MatchesController, LeaderboardController
│   │       ├── admin/          # AdminController (admin override, DLQ, audit log)
│   │       ├── matches/        # Match-scoped sub-controllers (result, confirmations)
│   │       ├── leaderboard/    # Leaderboard sub-controllers
│   │       ├── health/         # HealthController (GET /health)
│   │       ├── filters/        # Global HTTP exception filter
│   │       └── main.ts         # Fastify bootstrap, Swagger setup, global pipes
│   ├── auth/                   # Azure SSO handler (Fastify, port 3001)
│   │   └── src/
│   │       ├── controllers/    # MSAL redirect/callback controllers
│   │       ├── auth.controller.ts  # /auth/login, /auth/refresh, /auth/logout, /auth/me
│   │       ├── connect.controller.ts # /connect — Azure SSO OAuth2 callback
│   │       ├── users.controller.ts # /users/me GET + PATCH
│   │       └── main.ts         # Auth app bootstrap
│   ├── worker/                 # BullMQ job consumer (no HTTP port)
│   │   └── src/
│   │       ├── processors/     # match-confirmed, leaderboard-invalidate, audit-log processors
│   │       └── main.ts
│   └── producer/               # BullMQ publisher + cron scheduler (no HTTP port)
│       └── src/
│           ├── schedulers/     # leaderboard-cron.service (scheduled cache warm-up)
│           └── main.ts
├── libs/
│   ├── auth/                   # MSAL strategy, JwtAuthGuard, RolesGuard, Graph API fallback
│   ├── common/                 # Shared DTOs, decorators, guards base, pipes, utilities
│   ├── database/               # TypeORM DataSource config, base repository
│   ├── events/                 # BullMQ typed event contracts (EventEnvelope, queue names)
│   ├── jobs/                   # BullMQ queue injection tokens and shared job utilities
│   ├── leaderboard/            # Leaderboard queries, time-filter aggregations, Redis cache layer
│   ├── matches/                # Match entity, services, quorum logic, audit log service
│   └── users/                  # User entity, UserService, is_admin sync logic
├── migrations/                 # Versioned TypeORM migration files (001–006)
├── test/                       # End-to-end test specs (Supertest against in-memory NestJS app)
│   ├── match-lifecycle.e2e-spec.ts
│   ├── match-confirmation.e2e-spec.ts
│   ├── match-lock.e2e-spec.ts
│   ├── match-confirmation-cancel.e2e-spec.ts
│   ├── admin-override.e2e-spec.ts
│   ├── leaderboard.e2e-spec.ts
│   ├── auth-sso.e2e-spec.ts
│   └── helpers/                # Test fixtures, JWT helpers, mock factories
├── docker-compose.yml          # Local infrastructure: MySQL 8 + Redis 7
├── .env.example                # All required environment variables with defaults
├── nest-cli.json               # NestJS monorepo project definitions
├── tsconfig.json               # Root TypeScript config with path aliases
├── tsconfig.test.json          # Test-specific tsconfig (module: commonjs for Jest)
└── package.json                # Workspace root — scripts, dependencies
```

---

## Features

- **Match management** — Create 1v1, 2v2 (default), or 4v4 matches; add players to teams A and B; record the final score
- **Quorum confirmation** — A result is locked only after `floor(n/2) + 1` players confirm it; partial confirmations are visible in real time
- **Immutability post-confirmation** — Confirmed results return 409 on any modification attempt by regular users
- **Confirmation reset** — The match creator can cancel the confirmation phase, clearing all votes, to re-enter a corrected result
- **Admin overrides** — Administrators can correct the score on any confirmed match; every change is written to an append-only audit log with before/after snapshots
- **Leaderboard — users** — Top players ranked by wins, filterable by `week`, `month`, `year`, or `total`
- **Leaderboard — pairs** — Top 2-player pairs ranked by wins together, same time filters; pair identity is order-independent
- **Azure AD SSO** — Login via corporate Microsoft account; no local password management
- **Role management** — Admin status derived from Azure AD group membership (`ADMIN_AZURE_GROUP_ID`), synced to DB at each login and embedded in JWT
- **Graph API fallback** — When Azure AD omits the `groups` claim (>150 groups), the app falls back to `GET /v1.0/me/memberOf` via Microsoft Graph
- **Async events** — Match confirmation, leaderboard cache invalidation, and audit log writes are processed asynchronously by BullMQ with retry and dead-letter queue
- **DLQ management** — Admins can list and retry failed BullMQ jobs via REST endpoints
- **Swagger UI** — Interactive API docs at `GET /api/docs` with full request/response schemas, examples, and bearer auth support

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20, TypeScript 5.7 |
| Framework | NestJS 11 |
| HTTP adapter | Fastify (replaces Express) |
| Database | MySQL 8 |
| ORM | TypeORM 0.3.x (migration-first, `synchronize: false`) |
| Cache / Queue broker | Redis 7 |
| Job queue | BullMQ 5.x |
| Authentication | Azure AD via MSAL Node, internal JWT (15 min) + refresh token (24 h) |
| API documentation | `@nestjs/swagger` at `/api/docs` |
| Validation | `class-validator` + `class-transformer` |
| Rate limiting | `@nestjs/throttler` |
| Testing | Jest 30, Supertest, `ioredis-mock` |

---

## Azure AD Configuration

### App Registration requirements

1. Open **Azure Active Directory > App registrations** in the Azure Portal.
2. Create or select the App Registration for foosball-api.
3. Under **Authentication**, add a redirect URI pointing to `apps/auth`:
   - Development: `http://localhost:3001/connect`
   - Production: `https://<your-domain>/connect`
4. Under **Token configuration**, click **Add groups claim**:
   - Select **Security groups**.
   - Enable the groups claim in **ID token** and **Access token**.
5. Under **API permissions**, add:
   - `GroupMember.Read.All` (delegated) — required for the Graph API fallback when a user belongs to more than 150 groups.
   - Grant admin consent for your tenant.
6. Under **Certificates & secrets**, create a client secret and copy its value to `AZURE_CLIENT_SECRET` in `.env`.

### Groups claim cap and Graph API fallback

Azure AD includes the `groups` claim only when the user belongs to 150 or fewer groups. For users exceeding this limit, Azure AD omits `groups` and includes `_claim_names`/`_claim_sources` instead.

The auth app detects this automatically and calls `GET /v1.0/me/memberOf` on the Microsoft Graph API using the user's delegated access token. If the Graph API is unavailable, the user is authenticated but receives no admin role (safe default). The error is logged at `warn` level.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all required values.

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | Yes | — | `development`, `test`, or `production` |
| `LOG_LEVEL` | No | `debug` | Log verbosity level |
| `API_PORT` | No | `3000` | HTTP port for `apps/api` |
| `AUTH_PORT` | No | `3001` | HTTP port for `apps/auth` |
| `DB_HOST` | Yes | — | MySQL hostname (e.g., `localhost`) |
| `DB_PORT` | No | `3306` | MySQL port |
| `DB_USER` | Yes | — | MySQL username |
| `DB_PASSWORD` | Yes | — | MySQL password |
| `DB_NAME` | Yes | — | MySQL database name |
| `DB_ROOT_PASSWORD` | No | `rootpassword` | Root password for docker-compose MySQL init only |
| `REDIS_HOST` | Yes | — | Redis hostname (e.g., `localhost`) |
| `REDIS_PORT` | No | `6379` | Redis port |
| `REDIS_PASSWORD` | No | (empty) | Redis password; leave empty for no-auth |
| `JWT_SECRET` | Yes | — | Secret for signing internal JWTs — minimum 32 chars, never commit a real value |
| `JWT_ACCESS_TTL` | No | `15m` | Internal access token TTL |
| `JWT_REFRESH_TTL` | No | `24h` | Refresh token TTL |
| `AZURE_TENANT_ID` | Yes | — | Azure AD Directory (tenant) ID |
| `AZURE_CLIENT_ID` | Yes | — | Azure App Registration Application (client) ID |
| `AZURE_CLIENT_SECRET` | Yes | — | Azure App Registration client secret value |
| `AZURE_REDIRECT_URI` | Yes | — | Full OAuth2 callback URL (must match App Registration) |
| `ADMIN_AZURE_GROUP_ID` | Yes | — | Object ID of the Azure AD group whose members become admins |
| `CORS_ORIGINS` | No | (empty) | Comma-separated allowed CORS origins; empty means no browser clients |

---

## API Overview

Full interactive documentation is available at:

```
http://localhost:3000/api/docs
```

High-level endpoint groups (all under `/api/v1` except health and auth):

| Group | Endpoints |
|---|---|
| Health | `GET /health` |
| Auth | `GET /auth/login`, `GET /connect`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| Users | `GET /users/me`, `PATCH /users/me` |
| Matches | `POST /matches`, `GET /matches`, `GET /matches/:id`, `PATCH /matches/:id`, `DELETE /matches/:id` |
| Match players | `POST /matches/:id/players` |
| Match result | `POST /matches/:id/result` |
| Confirmations | `GET /matches/:id/confirmations`, `POST /matches/:id/confirmations`, `POST /matches/:id/confirmations/cancel` |
| Leaderboard | `GET /leaderboard/users`, `GET /leaderboard/pairs` |
| Admin | `PATCH /admin/matches/:id/result`, `DELETE /admin/matches/:id`, `GET /admin/matches/:id/audit`, `GET /admin/dlq`, `POST /admin/dlq/:jobId/retry` |

All `/api/v1/*` endpoints require `Authorization: Bearer <access-token>` unless otherwise noted. Admin endpoints additionally require `is_admin: true` in the JWT payload.

See [docs/API.md](docs/API.md) for the full endpoint reference.

---

## Database Overview

Schema managed by TypeORM migrations in `migrations/`. Key tables:

| Table | Description |
|---|---|
| `users` | All authenticated users; `azure_oid` is the stable SSO lookup key; `is_admin` is a login-time cache of Azure AD group membership |
| `refresh_tokens` | Issued refresh tokens (SHA-256 hash only); single-use rotation, 24 h TTL |
| `matches` | Match records with type (1v1/2v2/4v4), status state machine, scores, and confirmed timestamp |
| `match_players` | Players in each match with team (A/B), slot (1–4), and optional position label |
| `match_confirmations` | Per-player confirmation votes; all rows deleted on creator cancel |
| `audit_logs` | Append-only record of every admin override; preserves history even if the match is later deleted |

Full DDL is in `.agentflow/architect/specs/schema.sql`.

---

## Branch Convention

| Branch | Purpose |
|---|---|
| `main` | Stable, production-ready code |
| `sprint-NN` | Active sprint work (e.g., `sprint-01`) |
| `feat/XXX` | Individual feature branches off the sprint branch |

---

## Local Development Notes

- All apps share a single `node_modules/` at the monorepo root.
- `docker compose up -d` starts MySQL 8 on port 3306 and Redis 7 on port 6379 with named volumes for data persistence.
- Run `npm run build` before any `migration:*` command — migrations execute from compiled JS in `dist/`.
- `apps/api` (port 3000) and `apps/auth` (port 3001) are independent NestJS processes with separate bootstrap configurations.
- `apps/worker` and `apps/producer` have no HTTP port; they connect to Redis for BullMQ.
- The worker must be running for quorum confirmation events and leaderboard cache invalidation to process. In production all four processes must run simultaneously.
- Unit tests use `ioredis-mock` for Redis and an in-memory SQLite-compatible DataSource — no real infrastructure needed.
- End-to-end tests (`npm run test:e2e`) spin up a full NestJS application context against a real test database. Set `NODE_ENV=test` and configure a dedicated test DB in `.env` before running.
