# foosball-api

REST API for recording and tracking company foosball (table football) match results during lunch breaks. Built on NestJS 11 + Fastify in a monorepo structure, with Azure AD SSO, BullMQ async jobs, MySQL persistence, and Redis caching.

---

## What is this

foosball-api is an internal company API that lets employees register foosball match results, confirm them via a quorum mechanism (majority of players must accept), and browse win-based leaderboards filtered by time period. Match results become immutable once confirmed by all required players. Administrators can override confirmed results, with all changes tracked in an append-only audit log.

---

## Prerequisites

- Node.js 20 or later (LTS recommended)
- npm 10 or later
- Docker and Docker Compose (for local MySQL + Redis)
- An Azure App Registration with redirect URI and group claims configured (see Azure AD Configuration below)

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
# Edit .env with your values (see Environment Variables below)
```

### 3. Start infrastructure (MySQL + Redis)

```bash
docker compose up -d
```

### 4. Run database migrations

```bash
npm run migration:run
```

### 5. Start development

Start the API app (HTTP server):

```bash
npm run start:dev api
```

Start the auth app (Azure SSO callback handler):

```bash
npm run start:dev auth
```

Start the worker (BullMQ job processor — optional for local dev):

```bash
npm run start:dev worker
```

### 6. Access Swagger UI

Open `http://localhost:3000/api/docs` in your browser.

---

## Available Commands

| Command | Description |
|---|---|
| `npm run start:dev api` | Start API app in watch mode |
| `npm run start:dev auth` | Start auth app in watch mode |
| `npm run start:dev worker` | Start worker app in watch mode |
| `npm run start:dev producer` | Start producer app in watch mode |
| `npm run build api` | Build API app |
| `npm run build auth` | Build auth app |
| `npm run build` | Build all apps |
| `npm run test` | Run all unit tests |
| `npm run test:cov` | Run tests with coverage report |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run lint` | Lint all TypeScript files |
| `npm run format` | Format all TypeScript files with Prettier |
| `npm run migration:generate <name>` | Generate a new TypeORM migration |
| `npm run migration:run` | Run pending migrations |
| `npm run migration:revert` | Revert the last migration |

---

## Project Structure

```
foosball-api/
├── apps/
│   ├── api/            # HTTP REST server (Fastify, port 3000)
│   │   └── src/        # Controllers, Fastify setup, Swagger config
│   ├── auth/           # Azure SSO handler (Fastify, port 3001)
│   │   └── src/        # MSAL callback, JWT issuance, is_admin sync
│   ├── worker/         # BullMQ consumer (no HTTP)
│   │   └── src/        # Job processors, DLQ handler
│   └── producer/       # BullMQ publisher + cron scheduler
│       └── src/        # Scheduled jobs, event publishing services
├── libs/
│   ├── common/         # Shared DTOs, decorators, guards base, pipes, utils
│   ├── database/       # TypeORM DataSource config, base repository
│   ├── events/         # BullMQ typed event contracts (payloads, queue names)
│   ├── matches/        # Match domain: entities, services, quorum logic, audit log
│   ├── leaderboard/    # Leaderboard queries, time-filter aggregations, cache layer
│   ├── auth/           # MSAL strategy, JwtAuthGuard, RolesGuard, Graph API fallback
│   └── users/          # User entity, UserService, is_admin sync logic
├── migrations/         # Versioned TypeORM migration files
├── test/               # End-to-end test specs
├── docker-compose.yml  # Local dev infrastructure (MySQL 8 + Redis 7)
├── .env.example        # All required environment variables
├── nest-cli.json       # NestJS monorepo project definitions
├── tsconfig.json       # TypeScript root config with path aliases
└── package.json        # Workspace root
```

---

## Features

- **Match management** — Create 1v1, 2v2, or 4v4 matches (default 2v2); add players; record the final score
- **Quorum confirmation** — A match result requires acceptance from a majority of players (floor(n/2) + 1) before becoming permanent
- **Immutability post-confirmation** — Confirmed results cannot be modified by regular users; attempts return 409
- **Confirmation reset** — The match creator can cancel the confirmation phase, reset acceptance votes, and re-enter a corrected result
- **Admin overrides** — Administrators can modify or delete confirmed match results; every override is recorded in an append-only audit log
- **Leaderboard — users** — Top players by wins, filterable by week, month, year, or all-time
- **Leaderboard — pairs** — Top player pairs by wins together, with the same time filters
- **Azure AD SSO** — Login via Microsoft corporate account; no local password management
- **Role management** — Admin status derived from Azure AD group membership (`ADMIN_AZURE_GROUP_ID`); cached on DB at login
- **Async events** — Match confirmation, leaderboard cache invalidation, and audit writes are processed asynchronously via BullMQ queues with retry and dead-letter queue
- **API documentation** — Full Swagger UI at `/api/docs` with request/response schemas and example values

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20, TypeScript 5.7 |
| Framework | NestJS 11 |
| HTTP adapter | Fastify (replaces Express) |
| Database | MySQL 8 |
| ORM | TypeORM 0.3.x (migration-first, `synchronize: false`) |
| Cache / Queue | Redis 7 |
| Job queue | BullMQ 5.x |
| Authentication | Azure AD (MSAL Node), internal JWT |
| API docs | Swagger (`@nestjs/swagger`) at `/api/docs` |
| Validation | `class-validator` + `class-transformer` |
| Rate limiting | `@nestjs/throttler` |
| Testing | Jest 30, Supertest |

---

## Azure AD Configuration

### App Registration requirements

1. In the Azure Portal, open **Azure Active Directory > App registrations**.
2. Create or select your App Registration for foosball-api.
3. Under **Authentication**, add a redirect URI: `http://localhost:3001/auth/callback` (and your production URL).
4. Under **Token configuration**, click **Add groups claim**:
   - Select **Security groups** (or **All groups** if users may belong to distribution groups).
   - Under **ID token**, enable the groups claim.
   - Under **Access token**, enable the groups claim.
5. Under **API permissions**, add:
   - `GroupMember.Read.All` (or `Directory.Read.All`) — delegated — required for the Graph API fallback (see below).
   - Grant admin consent for your tenant.
6. Under **Certificates & secrets**, create a client secret. Copy it to `AZURE_CLIENT_SECRET` in `.env`.

### Groups claim caps and Graph API fallback

Azure AD includes the `groups` claim in tokens only when the user belongs to **150 or fewer groups** (SAML/OIDC ID token) or **200 or fewer groups** (OAuth2 access token). For users exceeding this limit, Azure AD omits `groups` and adds `_claim_names` / `_claim_sources` to the token instead.

foosball-api detects the missing claim automatically and falls back to calling the Microsoft Graph API (`GET /v1.0/me/memberOf`) using the user's delegated access token. This fallback requires `GroupMember.Read.All` permission on the App Registration (see step 5 above).

If the Graph API is unavailable during login, the user is authenticated but granted no admin role (safe default). The error is logged at `warn` level.

### Required environment variables for Azure AD

```
AZURE_TENANT_ID          — Directory (tenant) ID from the App Registration overview
AZURE_CLIENT_ID          — Application (client) ID from the App Registration overview
AZURE_CLIENT_SECRET      — Client secret value (not the secret ID)
AZURE_REDIRECT_URI       — Full callback URL, e.g. http://localhost:3001/auth/callback
ADMIN_AZURE_GROUP_ID     — Object ID of the Azure AD group whose members become admins
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all values. The following table documents every variable:

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Yes | `development`, `test`, or `production` |
| `API_PORT` | No | HTTP port for `apps/api` (default: `3000`) |
| `AUTH_PORT` | No | HTTP port for `apps/auth` (default: `3001`) |
| **Database** | | |
| `DB_HOST` | Yes | MySQL hostname (e.g., `localhost`) |
| `DB_PORT` | No | MySQL port (default: `3306`) |
| `DB_NAME` | Yes | Database name |
| `DB_USER` | Yes | MySQL username |
| `DB_PASSWORD` | Yes | MySQL password |
| **Redis** | | |
| `REDIS_HOST` | Yes | Redis hostname (e.g., `localhost`) |
| `REDIS_PORT` | No | Redis port (default: `6379`) |
| `REDIS_PASSWORD` | No | Redis password (leave empty if no auth) |
| **Authentication** | | |
| `APP_JWT_SECRET` | Yes | Secret for signing internal JWTs (min 32 chars, random) |
| `APP_JWT_EXPIRY` | No | Internal JWT expiry (default: `900` seconds = 15 min) |
| `APP_REFRESH_TOKEN_EXPIRY` | No | Refresh token expiry in seconds (default: `86400` = 24h) |
| `AZURE_TENANT_ID` | Yes | Azure AD tenant ID |
| `AZURE_CLIENT_ID` | Yes | Azure App Registration client ID |
| `AZURE_CLIENT_SECRET` | Yes | Azure App Registration client secret |
| `AZURE_REDIRECT_URI` | Yes | OAuth2 callback URL |
| `ADMIN_AZURE_GROUP_ID` | Yes | Azure AD group Object ID for admin role |
| **CORS** | | |
| `CORS_ORIGINS` | No | Comma-separated allowed origins (empty = none) |
| **Rate limiting** | | |
| `THROTTLE_TTL` | No | Rate limit window in seconds (default: `60`) |
| `THROTTLE_LIMIT` | No | Max requests per window per IP (default: `100`) |
| **BullMQ** | | |
| `BULLMQ_DLQ_NOTIFY_EMAIL` | No | Email for DLQ alert notifications (optional) |

---

## API Overview

Swagger UI with full documentation, request/response schemas, and authentication is available at:

```
http://localhost:3000/api/docs
```

High-level endpoint groups:

| Group | Description |
|---|---|
| `POST /auth/login` | Initiates Azure AD OAuth2 flow |
| `GET /auth/callback` | OAuth2 callback; issues internal JWT |
| `POST /auth/refresh` | Refresh internal JWT using refresh token |
| `GET/POST/PATCH /matches` | Match CRUD and player management |
| `POST /matches/:id/confirm` | Submit confirmation vote (quorum mechanism) |
| `DELETE /matches/:id/confirmation` | Creator cancels confirmation phase |
| `GET /leaderboard/users` | Users leaderboard with time filters |
| `GET /leaderboard/pairs` | Pairs leaderboard with time filters |
| `PATCH /users/me` | Update own profile |
| `GET /admin/dlq` | (Admin) List dead-letter queue jobs |
| `POST /admin/dlq/:jobId/retry` | (Admin) Retry a DLQ job |

Full schemas are defined in Phase 3 (`api.yaml`).

---

## Database Overview

Key tables (full schema defined in Phase 3 `schema.sql`):

| Table | Description |
|---|---|
| `users` | Registered users; `azure_oid` for SSO lookup; `is_admin` cache |
| `matches` | Match records with type (1v1, 2v2, 4v4), status, and score |
| `match_players` | Junction: players in each match with team assignment |
| `confirmations` | Per-player confirmation votes for a match result |
| `refresh_tokens` | Issued refresh tokens (single-use, 24h TTL) |
| `audit_logs` | Append-only log of all admin overrides |

---

## Branch Convention

| Branch | Purpose |
|---|---|
| `main` | Stable, production-ready code |
| `sprint-NN` | Active sprint work (e.g., `sprint-01`) |
| `feat/XXX` | Individual feature branches off the sprint branch |

---

## Local Development Notes

- All apps share a single `node_modules/` at the root (monorepo workspace).
- The `docker compose up -d` command starts MySQL 8 on port 3306 and Redis 7 on port 6379.
- TypeORM migrations must be run manually with `npm run migration:run` after any schema change.
- The `apps/auth` app runs on a separate port (3001) from `apps/api` (3000). The two apps are independent NestJS processes.
- BullMQ queues use the Redis instance. The worker app must be running to process queued jobs.
