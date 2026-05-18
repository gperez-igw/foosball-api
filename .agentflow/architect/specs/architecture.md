---
id: spec-arch-001
type: spec
project: foosball-api
sprint: "01"
created_by: architect
created_at: 2026-05-15
updated_at: 2026-05-18
status: approved
requires_decision: false
---

# Architecture — foosball-api

## Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Runtime | Node.js 20 | LTS |
| Framework | NestJS (Fastify adapter) | Monorepo with apps/ + libs/ |
| Language | TypeScript 5 | strict mode |
| Database | MySQL 8 | TypeORM, migrations-only (synchronize: false) |
| Cache | Redis 7 | leaderboard, BullMQ |
| Queue | BullMQ | match events, audit-log-write, leaderboard-invalidate |
| Auth | Azure AD (MSAL ConfidentialClientApplication) + internal JWT | See Auth section |
| Test | Jest + ts-jest | unit + e2e |

---

## Project Layout

```
apps/
  auth/          HTTP server — Azure SSO, token refresh/logout, identity
  api/           HTTP server — matches, confirmations, leaderboard, admin
  worker/        BullMQ workers (match-confirmed, leaderboard-invalidate, audit-log)
libs/
  auth/          AzureAdService, AuthService, TokenService, RefreshTokenService
  users/         UserService, UserEntity
  matches/       MatchService, ConfirmationService, AdminOverrideService
  leaderboard/   LeaderboardService (Redis cache + MySQL fallback)
  events/        EventEnvelope shared schema
  database/      DataSource (TypeORM), migrations
```

---

## Auth Architecture

### Web Flow (unchanged)

```
Browser → GET /auth/login
       ← 302  https://login.microsoftonline.com/…?redirect_uri=AZURE_REDIRECT_URI
Browser → Azure login
       ← 302  AZURE_REDIRECT_URI (/connect?code=…&state=…)
GET /connect?code=…&state=…
       ← 200  { accessToken, refreshToken, expiresIn }
```

The web redirect URI is `AZURE_REDIRECT_URI` (e.g. `http://localhost:3001/connect`).

### Mobile Flow B — Separate Code Exchange (NEW)

```
Tauri app → GET /auth/login?client=mobile
          ← 200  { url: "https://login.microsoftonline.com/…?redirect_uri=foosball://auth/callback" }
Tauri app opens url in system browser
User logs in on Azure
Azure → deep-link  foosball://auth/callback?code=…&state=…
OS routes deep link → Tauri app
Tauri app → POST /connect/exchange  { code, state }
          ← 200  { accessToken, refreshToken, expiresIn }
```

The mobile redirect URI is `AZURE_MOBILE_REDIRECT_URI` (e.g. `foosball://auth/callback`).
Both URIs must be registered as Reply URLs in the Azure App Registration.

### Dual Redirect URI Design

`AzureAdService.getAuthCodeUrl(redirectUri: string)` and
`AzureAdService.exchangeCode(code, state, redirectUri: string)` are
**parameterized** — the caller passes the redirect URI.
`AzureAdService` reads both `AZURE_REDIRECT_URI` and `AZURE_MOBILE_REDIRECT_URI`
from config and exposes them as `webRedirectUri` and `mobileRedirectUri` getters
so callers do not read env vars directly.

`AuthService.getLoginUrl(client?: 'web' | 'mobile')` selects the URI.
`AuthService.handleMobileExchange(code, state)` calls `exchangeCode` with the
mobile URI and then runs the same upsert + token-pair issuance path.

### State / CSRF

Azure generates the `state` nonce and echoes it back in the redirect.
The mobile client MUST pass the same `state` value it received from the authorize
URL back to `POST /connect/exchange`. The backend forwards `state` to MSAL's
`acquireTokenByCode` which validates it internally.
No additional server-side state store is required — MSAL owns the nonce check.

### PKCE

Not required: the backend is the OAuth2 **confidential client** and holds the
`AZURE_CLIENT_SECRET`. PKCE is a mitigation for public clients where the client
secret cannot be kept private. Since all code-exchange calls are server-side,
the client secret is never exposed to the mobile app, and PKCE adds no additional
security benefit in this topology.

### Why JSON response for mobile login, not 302

`GET /auth/login?client=mobile` returns `200 { url }` instead of `302 Location`.
Rationale: a Tauri/native app cannot intercept a 302 response from a plain
`fetch()` call — the browser-side redirect following would attempt to load
`foosball://…` as a URL, not hand it back to the app. Returning the URL as JSON
lets the Tauri app call `open(url)` using the OS shell, which correctly triggers
the custom-scheme handler after Azure login.

---

## Security Spec

### Per-endpoint auth requirements

| Endpoint | Auth | Notes |
|----------|------|-------|
| GET /auth/login | Public | rate-limited 10 req/min/IP |
| GET /connect | Public | OAuth2 callback |
| POST /connect/exchange | Public | NEW — mobile code exchange |
| POST /auth/refresh | Public | rate-limited 10 req/min/IP |
| POST /auth/logout | Bearer JWT | |
| GET /auth/me | Bearer JWT | |
| All /api/v1/* | Bearer JWT | unless otherwise noted |
| All /admin/* | Bearer JWT + is_admin=true | |

### Input validation

- `POST /connect/exchange`: `code` string non-empty, max 2048 chars; `state` string non-empty, max 512 chars. Validated with class-validator (NestJS pipe) or manual guard before calling MSAL.
- `GET /auth/login?client=`: optional query param, accepted values `web` | `mobile`; unknown value defaults to `web`.

### Secrets

`AZURE_CLIENT_SECRET` and `JWT_SECRET` must never appear in source code.
`AZURE_MOBILE_REDIRECT_URI` is not a secret but must be in env vars.

### Rate limiting

`POST /connect/exchange` shares the same ThrottlerModule global limit (100 req/min);
if needed the route can be decorated with `@Throttle({ default: { ttl: 60000, limit: 20 } })`.

### CORS

`CORS_ORIGINS` env var applies to web clients. The mobile app communicates
directly with the API (no browser CORS restriction applies).

---

## Performance Spec

- Leaderboard: Redis cache, cursor-based pagination for matches list.
- Bundle: N/A (API only, no frontend bundle).
- The mobile exchange endpoint adds no DB reads beyond the existing `handleCallback` path.

---

## Error Handling Spec

Standard error envelope: `{ error: { code: string, message: string, details?: object } }`

New error codes for mobile auth:
- `MOBILE_EXCHANGE_FAILED` — MSAL returned null or threw during `acquireTokenByCode`
- `INVALID_CALLBACK` — already used for web flow; reused for missing code/state in exchange endpoint

---

## Testing

- **Framework**: Jest + ts-jest
- **Test script**: `"test": "jest"` in root package.json
- **Config**: `jest.config.js` with `ts-jest`, `tsconfig.test.json` (CommonJS)
- **Unit test directories**: `libs/*/src/*.spec.ts`, `apps/*/src/*.spec.ts`
- **E2E test directory**: `test/*.e2e-spec.ts`
- **Naming**: `*.spec.ts` for unit, `*.e2e-spec.ts` for e2e
- **Coverage target**: ≥ 80% statement on libs/auth, libs/users, libs/matches, libs/leaderboard

New unit test files required for mobile auth:
- `libs/auth/src/azure-ad.service.spec.ts` — add tests for parameterized `getAuthCodeUrl(uri)` and `exchangeCode(code, state, uri)`
- `apps/auth/src/connect.controller.spec.ts` — add tests for `POST /connect/exchange` happy path and error paths
- `libs/auth/src/auth.service.spec.ts` — add tests for `getLoginUrl('mobile')` and `handleMobileExchange(code, state)`

---

## Dependency Spec

No new npm dependencies required. All mobile auth changes use:
- `@azure/msal-node` (already installed) — `acquireTokenByCode` with custom `redirectUri`
- `@nestjs/common`, `@nestjs/config` (already installed)

---

## Change Log

| Date | Change |
|------|--------|
| 2026-05-15 | Initial architecture — Sprint-01 |
| 2026-05-18 | Added Mobile Auth Flow B (decision-2026-05-18-1518-mobile-auth-code-exchange.md): dual redirect URI design, `POST /connect/exchange`, `GET /auth/login?client=mobile` JSON variant |
