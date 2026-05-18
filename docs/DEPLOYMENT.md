# Deployment Guide — foosball-api

foosball-api is a monorepo of four NestJS processes. In production all four must run simultaneously and share access to the same MySQL 8 database and Redis 7 instance.

---

## Infrastructure Requirements

| Service | Version | Purpose |
|---|---|---|
| Node.js | 20 LTS | Runtime for all four processes |
| MySQL | 8.0 | Primary persistence |
| Redis | 7 | BullMQ job queues + leaderboard cache |

Both MySQL and Redis must be reachable from all four application processes. BullMQ uses Redis for queue state — if Redis restarts, queued jobs that were in-flight are re-enqueued by BullMQ's persistence layer.

---

## Environment Variables

All variables must be set in the process environment before starting any app. There is no fallback to defaults in production for required variables.

Copy `.env.example` to `.env` (or inject via your platform's secret manager) and fill in every value.

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Yes | Set to `production` |
| `LOG_LEVEL` | No | `info` recommended for production |
| `API_PORT` | No | Port for `apps/api` — default `3000` |
| `AUTH_PORT` | No | Port for `apps/auth` — default `3001` |
| `DB_HOST` | Yes | MySQL hostname |
| `DB_PORT` | No | MySQL port — default `3306` |
| `DB_USER` | Yes | MySQL username |
| `DB_PASSWORD` | Yes | MySQL password |
| `DB_NAME` | Yes | MySQL database name |
| `REDIS_HOST` | Yes | Redis hostname |
| `REDIS_PORT` | No | Redis port — default `6379` |
| `REDIS_PASSWORD` | No | Redis password if AUTH is enabled |
| `JWT_SECRET` | Yes | Minimum 32 characters, random, stored as a secret — never committed to source control |
| `JWT_ACCESS_TTL` | No | Access token TTL — default `15m` |
| `JWT_REFRESH_TTL` | No | Refresh token TTL — default `24h` |
| `AZURE_TENANT_ID` | Yes | Azure AD Directory (tenant) ID |
| `AZURE_CLIENT_ID` | Yes | Azure App Registration client ID |
| `AZURE_CLIENT_SECRET` | Yes | Azure App Registration client secret — store as a secret, never in code |
| `AZURE_REDIRECT_URI` | Yes | Production callback URL, e.g. `https://auth.yourdomain.com/auth/callback` |
| `ADMIN_AZURE_GROUP_ID` | Yes | Object ID of the Azure AD group whose members become admins |
| `CORS_ORIGINS` | No | Comma-separated allowed origins for the API, e.g. `https://app.yourdomain.com` |

---

## Build

Build all four apps from the monorepo root:

```bash
npm ci
npm run build
```

This compiles each app to `dist/apps/{api,auth,worker,producer}/main.js` and the shared libs to `dist/libs/`.

To build individual apps:

```bash
npm run build:api
npm run build:auth
npm run build:worker
npm run build:producer
```

The compiled output is required for TypeORM migration commands (see below).

---

## Database Migration

Migrations must be applied before starting any app process for the first time. They must also be applied when deploying a new sprint that contains schema changes.

TypeORM migrations operate on the compiled DataSource:

```bash
# Build first (migrations run from dist/)
npm run build

# Apply all pending migrations
npm run migration:run
```

The six migrations and their required execution order:

| File | Creates |
|---|---|
| `001-AddUsersTable` | `users` |
| `002-AddRefreshTokensTable` | `refresh_tokens` |
| `003-AddMatchesTable` | `matches` |
| `004-AddMatchPlayersTable` | `match_players` |
| `005-AddMatchConfirmationsTable` | `match_confirmations` |
| `006-AddAuditLogsTable` | `audit_logs` |

Migrations must be run in numerical order. TypeORM tracks applied migrations in a `migrations` table and skips already-applied ones.

To roll back the last migration:

```bash
npm run migration:revert
```

---

## Running the Four Processes

Each process is started from the compiled output. In production use a process manager (systemd, PM2, or a container orchestrator) to keep them running and restart on failure.

### apps/api — HTTP REST server

```bash
node dist/apps/api/main
```

Default port: `3000` (override with `API_PORT` env var)
Exposes: all `/api/v1/*` REST endpoints and `GET /api/docs` (Swagger UI)

### apps/auth — Azure SSO handler

```bash
node dist/apps/auth/main
```

Default port: `3001` (override with `AUTH_PORT` env var)
Exposes: `/auth/login`, `/auth/callback`, `/auth/refresh`, `/auth/logout`, `/auth/me`, `/users/me`

The `AZURE_REDIRECT_URI` must point to this process's `/auth/callback` URL. Configure the matching Redirect URI in your Azure App Registration.

### apps/worker — BullMQ job consumer

```bash
node dist/apps/worker/main
```

No HTTP port. Connects to Redis and processes jobs from the `matches`, `leaderboard`, and `audit` queues.

Processors:
- `match-confirmed` — handles leaderboard cache population on match confirmation
- `leaderboard-invalidate` — clears stale leaderboard cache entries in Redis
- `audit-log` — writes audit log entries to MySQL

If the worker is not running, BullMQ jobs will accumulate in Redis queues until the worker restarts. Jobs are retried up to 5 times with exponential backoff before moving to the DLQ.

### apps/producer — BullMQ cron publisher

```bash
node dist/apps/producer/main
```

No HTTP port. Runs scheduled jobs:
- `leaderboard-cron` — periodically publishes leaderboard warm-up events to keep the Redis cache fresh

---

## Docker Compose (local / staging)

The provided `docker-compose.yml` starts MySQL 8 and Redis 7 with named volumes for data persistence:

```bash
# Start infrastructure
docker compose up -d

# Stop and remove containers (volumes preserved)
docker compose down

# Stop and remove containers AND volumes (destructive)
docker compose down -v
```

Environment variables consumed by docker-compose:

| Variable | Default | Description |
|---|---|---|
| `DB_ROOT_PASSWORD` | `rootpassword` | MySQL root password for container init |
| `DB_NAME` | `foosball` | Database name created on first start |
| `DB_USER` | `foosball` | Database user |
| `DB_PASSWORD` | `foosball` | Database user password |
| `DB_PORT` | `3306` | Host-side MySQL port |
| `REDIS_PASSWORD` | (empty) | Redis password; empty = no auth |
| `REDIS_PORT` | `6379` | Host-side Redis port |

Both services have healthchecks. Wait for `healthy` status before running migrations:

```bash
docker compose ps
```

---

## Deployment Sequence

The recommended sequence for a fresh deployment:

1. Provision MySQL 8 and Redis 7
2. Set all environment variables
3. `npm ci` — install dependencies
4. `npm run build` — compile all apps
5. `npm run migration:run` — apply schema migrations
6. Start all four processes (in any order):
   - `node dist/apps/api/main`
   - `node dist/apps/auth/main`
   - `node dist/apps/worker/main`
   - `node dist/apps/producer/main`
7. Verify: `GET /health` on the API port should return `{ "status": "ok" }`
8. Configure your load balancer or reverse proxy to route:
   - API traffic (`/api/*`, `/health`) to `apps/api` (port 3000)
   - Auth traffic (`/auth/*`, `/users/*`) to `apps/auth` (port 3001)

---

## Upgrade / Redeployment

1. Build new artifacts: `npm run build`
2. Apply any new migrations: `npm run migration:run`
3. Restart all four processes in order: `worker` and `producer` first, then `auth`, then `api`

This ordering ensures BullMQ consumers are ready to process any events emitted during the API startup.

---

## Health Check

```
GET /health   →  { "status": "ok", "timestamp": "..." }
```

Use this endpoint for load balancer health checks and readiness probes. It returns 200 if the API process is up. It does not check MySQL or Redis connectivity — those failures will surface on the first real request.

---

## Security Checklist

- `JWT_SECRET` must be at least 32 random characters and stored in a secret manager, not in source control or docker-compose files.
- `AZURE_CLIENT_SECRET` must be stored in a secret manager.
- Set `CORS_ORIGINS` to your specific frontend origin(s). An empty value means no browser clients are allowed by CORS headers.
- Use a reverse proxy (nginx, Caddy, or your cloud provider's load balancer) in front of both HTTP processes — do not expose Node.js directly to the internet.
- Enable TLS termination at the reverse proxy layer.
- `AZURE_REDIRECT_URI` must use HTTPS in production and must match exactly the Redirect URI configured in the Azure App Registration.
