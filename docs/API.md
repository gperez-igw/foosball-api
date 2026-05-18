# Foosball API — REST Reference

Version: 1.0.0
Base URL: `/api/v1`
Interactive docs: `GET /api/docs` (Swagger UI, available when `apps/api` is running)

---

## Authentication

All `/api/v1/*` endpoints require a Bearer token unless marked **Public**.

```
Authorization: Bearer <access-token>
```

**Token flow:**

1. `GET /auth/login` — browser redirect to Azure AD
2. `GET /auth/callback` — Azure AD returns here; the server issues an internal JWT + refresh token pair
3. Use the `accessToken` as the Bearer token for all subsequent requests
4. `POST /auth/refresh` — exchange a refresh token for a new token pair before the 15-minute access token expires
5. `POST /auth/logout` — invalidate the refresh token

Admin endpoints additionally require `is_admin: true` in the JWT payload (set at login based on Azure AD group membership).

---

## Error Envelope

All error responses use a consistent envelope:

```json
{
  "error": {
    "code": "MATCH_ALREADY_CONFIRMED",
    "message": "Cannot modify a confirmed match",
    "details": { "matchId": 42, "status": "confirmed" }
  }
}
```

| Field | Type | Description |
|---|---|---|
| `error.code` | string | Machine-readable error code |
| `error.message` | string | Human-readable description |
| `error.details` | object | Optional extra context |

---

## Common HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 204 | No Content (successful delete) |
| 400 | Bad Request — validation failed |
| 401 | Unauthorized — missing or invalid Bearer token |
| 403 | Forbidden — authenticated but insufficient role or ownership |
| 404 | Not Found |
| 409 | Conflict — state machine violation (e.g., match locked) |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

---

## Endpoints

### Health

---

#### `GET /health` — Health check

**Auth:** Public

**Response 200**

```json
{
  "status": "ok",
  "timestamp": "2026-05-18T10:00:00.000Z"
}
```

---

### Auth

Auth routes are served by `apps/auth` (port 3001 in development) and documented here for completeness.

---

#### `GET /auth/login` — Initiate Azure SSO login

**Auth:** Public
**Rate limit:** 10 req/min per IP

Redirects the browser to the Azure AD authorization endpoint. This endpoint does not return JSON.

**Response 302** — redirect to `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?...`

**Response 429**
```json
{ "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "Too many login attempts" } }
```

---

#### `GET /auth/callback` — Azure SSO OAuth2 callback

**Auth:** Public

Azure AD redirects here after user authentication. The server validates the OIDC token, upserts the user record, resolves admin group membership (with Graph API fallback for large group sets), and issues an internal JWT + refresh token pair.

**Query parameters**

| Name | Required | Description |
|---|---|---|
| `code` | Yes | OAuth2 authorization code from Azure AD |
| `state` | Yes | Anti-CSRF state parameter |
| `session_state` | No | Azure AD session state |

**Response 200**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "dGhpcyBpcyBhIHJhbmRvbSByZWZyZXNoIHRva2Vu",
  "expiresIn": 900
}
```

| Field | Type | Description |
|---|---|---|
| `accessToken` | string | Signed JWT, expires in 15 minutes |
| `refreshToken` | string | Opaque single-use token, 24 h TTL |
| `expiresIn` | integer | Access token TTL in seconds |

**Response 400** — Invalid or missing OAuth2 callback parameters

**Response 503** — Graph API unavailable (groups claim fallback failed)

---

#### `POST /auth/refresh` — Refresh access token

**Auth:** Public
**Rate limit:** 10 req/min per IP

Submits a valid refresh token and receives a new token pair. The submitted token is immediately invalidated (single-use rotation).

**Request body**

```json
{ "refreshToken": "dGhpcyBpcyBhIHJhbmRvbSByZWZyZXNoIHRva2Vu" }
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `refreshToken` | string | Yes | min 32 chars |

**Response 200** — new `TokenPair` (same shape as `/auth/callback` response)

**Response 401**
```json
{ "error": { "code": "INVALID_REFRESH_TOKEN", "message": "Refresh token is invalid, expired, or already used" } }
```

---

#### `POST /auth/logout` — Logout

**Auth:** Bearer token required

Invalidates the submitted refresh token. The access token remains valid until its natural 15-minute expiry — clients should discard it client-side.

**Request body**

```json
{ "refreshToken": "dGhpcyBpcyBhIHJhbmRvbSByZWZyZXNoIHRva2Vu" }
```

**Response 204** — logged out

---

#### `GET /auth/me` — Current user identity

**Auth:** Bearer token required

Returns the authenticated user's profile from the database, including the current `isAdmin` value.

**Response 200**

```json
{
  "id": 1,
  "email": "mario.rossi@company.com",
  "displayName": "Mario Rossi",
  "isAdmin": false,
  "createdAt": "2026-05-15T08:00:00.000Z"
}
```

---

### Users

---

#### `GET /users/me` — Get own profile

**Auth:** Bearer token required

Identical in shape to `GET /auth/me`. Use this endpoint on the API port (3000) when your client already has a valid Bearer token and does not need to go through the auth app.

**Response 200** — `UserProfile` (same shape as `/auth/me`)

---

#### `PATCH /users/me` — Update own profile

**Auth:** Bearer token required

Only `displayName` can be updated. `email` and `isAdmin` are read-only (managed by Azure AD sync at login).

**Request body**

```json
{ "displayName": "Mario R." }
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `displayName` | string | No | 1–255 chars |

**Response 200** — updated `UserProfile`

**Response 400**
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "displayName must be between 1 and 255 characters" } }
```

---

### Matches

---

#### `POST /matches` — Create a match

**Auth:** Bearer token required

Creates a match in `draft` status. The caller becomes the match creator. Players are added separately via `POST /matches/:id/players`.

**Request body**

```json
{ "matchType": "2v2" }
```

| Field | Type | Required | Values | Default |
|---|---|---|---|---|
| `matchType` | string | No | `1v1`, `2v2`, `4v4` | `2v2` |

**Response 201**

```json
{
  "id": 42,
  "matchType": "2v2",
  "status": "draft",
  "scoreA": null,
  "scoreB": null,
  "createdBy": 1,
  "createdAt": "2026-05-15T12:00:00.000Z",
  "confirmedAt": null,
  "players": []
}
```

---

#### `GET /matches` — List matches

**Auth:** Bearer token required

Returns a cursor-paginated list of matches ordered by `createdAt DESC`.

**Query parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `status` | string | No | Filter: `draft`, `playing`, `awaiting_confirmation`, `confirmed`, `cancelled` |
| `matchType` | string | No | Filter: `1v1`, `2v2`, `4v4` |
| `createdBy` | integer | No | Filter by creator user ID |
| `cursor` | string | No | Opaque cursor from previous page's `nextCursor` |
| `limit` | integer | No | Page size, 1–100, default 20 |

**Response 200**

```json
{
  "data": [
    {
      "id": 42,
      "matchType": "2v2",
      "status": "confirmed",
      "scoreA": 5,
      "scoreB": 3,
      "createdBy": 1,
      "createdAt": "2026-05-15T12:00:00.000Z",
      "confirmedAt": "2026-05-15T12:30:00.000Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "hasMore": false,
    "nextCursor": null
  }
}
```

---

#### `GET /matches/:matchId` — Get match detail

**Auth:** Bearer token required

**Path parameter:** `matchId` — integer, required

**Response 200** — `MatchDetail` (same fields as match summary plus `players` array)

```json
{
  "id": 42,
  "matchType": "2v2",
  "status": "confirmed",
  "scoreA": 5,
  "scoreB": 3,
  "createdBy": 1,
  "createdAt": "2026-05-15T12:00:00.000Z",
  "confirmedAt": "2026-05-15T12:30:00.000Z",
  "players": [
    { "userId": 1, "team": "A", "slot": 1, "position": null },
    { "userId": 2, "team": "A", "slot": 2, "position": "goalkeeper" },
    { "userId": 3, "team": "B", "slot": 1, "position": null },
    { "userId": 4, "team": "B", "slot": 2, "position": null }
  ]
}
```

**Response 404**
```json
{ "error": { "code": "MATCH_NOT_FOUND", "message": "Match 99 does not exist" } }
```

---

#### `PATCH /matches/:matchId` — Update match

**Auth:** Bearer token required (match creator only)

Allowed updates: `scoreA`, `scoreB`. `matchType` can only be changed if no players have been added yet.

Blocked when status is `awaiting_confirmation` or `confirmed` — returns 409.

**Request body**

```json
{ "scoreA": 6, "scoreB": 3 }
```

| Field | Type | Constraints |
|---|---|---|
| `scoreA` | integer | 0–255 |
| `scoreB` | integer | 0–255 |

**Response 200** — updated `MatchDetail`

**Response 403**
```json
{ "error": { "code": "FORBIDDEN_NOT_CREATOR", "message": "Only the match creator can update this match" } }
```

**Response 409**
```json
{
  "error": {
    "code": "MATCH_LOCKED",
    "message": "Cannot modify a match in awaiting_confirmation or confirmed status",
    "details": { "matchId": 42, "status": "awaiting_confirmation" }
  }
}
```

---

#### `DELETE /matches/:matchId` — Delete match (admin only)

**Auth:** Bearer token required, `is_admin: true`

Hard deletes the match. Cascades to `match_players` and `match_confirmations`. For confirmed matches, an audit log entry is written before deletion.

**Response 204** — deleted

**Response 403**
```json
{ "error": { "code": "FORBIDDEN_ADMIN_REQUIRED", "message": "This action requires admin privileges" } }
```

---

#### `POST /matches/:matchId/players` — Add players to a match

**Auth:** Bearer token required (match creator only)

Adds one or more players. Idempotent per `(matchId, userId, team, slot)`.

**Validations:**
- Match must be in `draft` or `playing` status
- No duplicate slot per team
- Total players must not exceed capacity (1v1 = 2, 2v2 = 4, 4v4 = 8)
- All referenced users must exist

**Request body**

```json
{
  "players": [
    { "userId": 1, "team": "A", "slot": 1 },
    { "userId": 2, "team": "A", "slot": 2 },
    { "userId": 3, "team": "B", "slot": 1 },
    { "userId": 4, "team": "B", "slot": 2 }
  ]
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `players` | array | Yes | 1–8 items |
| `players[].userId` | integer | Yes | Must exist in users table |
| `players[].team` | string | Yes | `A` or `B` |
| `players[].slot` | integer | Yes | 1–4 |
| `players[].position` | string | No | max 64 chars, e.g. `goalkeeper` |

**Response 200** — updated `MatchDetail` with all players

**Response 400**
```json
{
  "error": {
    "code": "SLOT_CONFLICT",
    "message": "Team A slot 1 is already occupied",
    "details": { "matchId": 42, "team": "A", "slot": 1 }
  }
}
```

---

#### `POST /matches/:matchId/result` — Submit match result

**Auth:** Bearer token required (match creator only)

Sets `scoreA` and `scoreB` and transitions the match to `awaiting_confirmation`. All required player slots must be filled before calling this endpoint.

A BullMQ event `match.result_submitted` is published after the transition.

**Request body**

```json
{ "scoreA": 5, "scoreB": 3 }
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `scoreA` | integer | Yes | 0–255 |
| `scoreB` | integer | Yes | 0–255 |

**Response 200** — `MatchDetail` with `status: "awaiting_confirmation"`

**Response 400**
```json
{
  "error": {
    "code": "INSUFFICIENT_PLAYERS",
    "message": "2v2 match requires 4 players (2 per team); only 3 registered"
  }
}
```

---

### Confirmations

---

#### `GET /matches/:matchId/confirmations` — Get confirmation status

**Auth:** Bearer token required (any authenticated user)

Returns current quorum progress for a match that is in `awaiting_confirmation` status.

**Quorum formula:** `floor(totalPlayers / 2) + 1`

**Response 200**

```json
{
  "matchId": 42,
  "totalPlayers": 4,
  "confirmedCount": 2,
  "quorumRequired": 3,
  "quorumReached": false,
  "confirmations": [
    { "userId": 1, "confirmedAt": "2026-05-15T12:05:00.000Z" },
    { "userId": 3, "confirmedAt": "2026-05-15T12:06:00.000Z" }
  ]
}
```

**Response 409** — match is not in `awaiting_confirmation` status

---

#### `POST /matches/:matchId/confirmations` — Confirm result

**Auth:** Bearer token required (players of the match only)

Records the calling user's confirmation vote. Idempotent — confirming twice is a no-op. When `confirmedCount` reaches `quorumRequired`:
- Match status transitions to `confirmed`
- `confirmed_at` timestamp is set
- BullMQ events `match.confirmed` and `leaderboard-invalidate` are published

**Response 200** — updated `ConfirmationStatus`

When quorum is reached, `quorumReached: true` and the match is now immutable.

**Response 403**
```json
{ "error": { "code": "NOT_A_PLAYER", "message": "You are not registered as a player in this match" } }
```

---

#### `POST /matches/:matchId/confirmations/cancel` — Cancel confirmation phase

**Auth:** Bearer token required (match creator only)

Resets the confirmation phase: deletes all confirmation votes and reverts match status from `awaiting_confirmation` to `playing`. Scores are preserved (the creator can then update them via `PATCH /matches/:id`).

Not allowed if the match is already `confirmed`.

A BullMQ event `match.confirmation_cancelled` is published on success.

**Response 200** — `ConfirmationStatus` with `confirmedCount: 0` and empty `confirmations` array

**Response 409**
```json
{
  "error": {
    "code": "MATCH_ALREADY_CONFIRMED",
    "message": "A confirmed match result cannot be cancelled",
    "details": { "matchId": 42, "status": "confirmed" }
  }
}
```

---

### Leaderboard

Leaderboard responses are cached in Redis. The `X-Cache` response header indicates cache status: `HIT`, `MISS`, or `BYPASS`.

If Redis is unavailable, the app falls back to a direct MySQL query (degraded mode, no cache header).

---

#### `GET /leaderboard/users` — User win leaderboard

**Auth:** Bearer token required

Ranks users by win count in confirmed matches where the user was on the winning team.

**Cache TTL:** 300 seconds for `week`/`month`; 3600 seconds for `year`/`total`.

**Query parameters**

| Name | Type | Required | Values | Default |
|---|---|---|---|---|
| `filter` | string | No | `week`, `month`, `year`, `total` | `total` |
| `limit` | integer | No | 1–100 | 20 |

**Response 200**

```json
{
  "filter": "week",
  "generatedAt": "2026-05-15T12:00:00.000Z",
  "data": [
    { "rank": 1, "userId": 3, "displayName": "Mario Rossi", "wins": 7 },
    { "rank": 2, "userId": 5, "displayName": "Luca Bianchi", "wins": 5 }
  ]
}
```

---

#### `GET /leaderboard/pairs` — Pair win leaderboard

**Auth:** Bearer token required

Ranks 2-player pairs by wins together in confirmed 2v2 and 4v4 matches. Pair identity is order-independent: `(min(userA, userB), max(userA, userB))`. In 4v4 matches, each unique 2-player combination on the winning team is counted independently.

Same cache TTL policy as `/leaderboard/users`.

**Query parameters** — same as `/leaderboard/users`

**Response 200**

```json
{
  "filter": "month",
  "generatedAt": "2026-05-15T12:00:00.000Z",
  "data": [
    {
      "rank": 1,
      "userA": { "userId": 3, "displayName": "Mario Rossi" },
      "userB": { "userId": 5, "displayName": "Luca Bianchi" },
      "wins": 5
    }
  ]
}
```

---

### Admin

All admin endpoints require `is_admin: true` in the JWT payload. Regular users receive 403.

---

#### `PATCH /admin/matches/:matchId/result` — Override confirmed match result

**Auth:** Bearer token required, admin only

Corrects the score of a confirmed match. An audit log entry is written atomically before the score is updated (before/after snapshot). BullMQ events `audit-log-write` and `leaderboard-invalidate` are published. The match remains in `confirmed` status after the override.

If the audit log event publish fails, the entire operation is rolled back and a 500 is returned.

**Request body**

```json
{
  "scoreA": 6,
  "scoreB": 3,
  "reason": "Score entry error confirmed by both teams"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `scoreA` | integer | Yes | 0–255 |
| `scoreB` | integer | Yes | 0–255 |
| `reason` | string | No | max 1000 chars |

**Response 200**

```json
{
  "match": {
    "id": 42,
    "matchType": "2v2",
    "status": "confirmed",
    "scoreA": 6,
    "scoreB": 3,
    "createdBy": 1,
    "createdAt": "2026-05-15T12:00:00.000Z",
    "confirmedAt": "2026-05-15T12:30:00.000Z",
    "players": []
  },
  "auditLog": {
    "id": 1,
    "actorId": 2,
    "action": "result_override",
    "entityType": "match",
    "entityId": 42,
    "beforeData": { "scoreA": 5, "scoreB": 3 },
    "afterData": { "scoreA": 6, "scoreB": 3 },
    "reason": "Score entry error confirmed by both teams",
    "createdAt": "2026-05-15T13:00:00.000Z"
  }
}
```

**Response 409** — match is not in `confirmed` status
```json
{
  "error": {
    "code": "MATCH_NOT_CONFIRMED",
    "message": "Admin result override only applies to confirmed matches",
    "details": { "status": "awaiting_confirmation" }
  }
}
```

**Response 500** — audit log write failed; operation rolled back
```json
{ "error": { "code": "AUDIT_LOG_WRITE_FAILED", "message": "Audit log could not be written; operation rolled back" } }
```

---

#### `DELETE /admin/matches/:matchId` — Delete any match (admin only)

**Auth:** Bearer token required, admin only

Hard deletes any match regardless of status. For confirmed matches, writes an audit log entry before deletion. Cascades to `match_players` and `match_confirmations`.

**Response 204** — deleted

---

#### `GET /admin/matches/:matchId/audit` — Get audit log for a match

**Auth:** Bearer token required, admin only

Returns all audit log entries for the match, ordered by `createdAt ASC`. Entries remain visible even if the match itself has been deleted (`entity_id` is a soft reference with no FK).

**Response 200**

```json
{
  "data": [
    {
      "id": 1,
      "actorId": 2,
      "action": "result_override",
      "entityType": "match",
      "entityId": 42,
      "beforeData": { "scoreA": 5, "scoreB": 3 },
      "afterData": { "scoreA": 6, "scoreB": 3 },
      "reason": "Score entry error confirmed by both teams",
      "createdAt": "2026-05-15T13:00:00.000Z"
    }
  ]
}
```

---

#### `GET /admin/dlq` — List DLQ jobs

**Auth:** Bearer token required, admin only

Lists BullMQ jobs that exhausted all retry attempts.

**Query parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `queue` | string | No | Filter by queue: `matches`, `leaderboard`, or `audit` |

**Response 200**

```json
{
  "data": [
    {
      "jobId": "42",
      "queue": "matches",
      "name": "match.confirmed",
      "data": { "matchId": 42, "version": 1 },
      "failedReason": "connect ECONNREFUSED 127.0.0.1:3306",
      "attemptsMade": 5,
      "timestamp": 1715774400000
    }
  ]
}
```

---

#### `POST /admin/dlq/:jobId/retry` — Retry a DLQ job

**Auth:** Bearer token required, admin only

Re-queues a job from the DLQ back into its original queue.

**Path parameter:** `jobId` — string (BullMQ job ID)

**Response 200**

```json
{ "jobId": "42", "status": "requeued" }
```

**Response 404** — job not found in DLQ

---

## Schemas Reference

### MatchStatus state machine

```
draft → playing → awaiting_confirmation → confirmed
                                        → (cancel) → playing
cancelled  (terminal — set by admin delete or future logic)
```

### MatchType capacities

| Type | Players required |
|---|---|
| `1v1` | 2 (1 per team) |
| `2v2` | 4 (2 per team) |
| `4v4` | 8 (4 per team) |

### TimeFilter values

| Value | Window |
|---|---|
| `week` | last 7 days |
| `month` | last 30 days |
| `year` | last 365 days |
| `total` | all time |
