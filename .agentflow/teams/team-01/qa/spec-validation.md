---
id: spec-validation-001
type: spec-validation
project: foosball-api
sprint: "01"
team: team-01
created_by: qa
created_at: 2026-05-18
status: pass
requires_decision: false
---

# Spec Validation Report

## Routes

Compared api.yaml endpoints against implemented route definitions in `apps/api/src/` and `apps/auth/src/`.

| Endpoint | Spec (api.yaml) | Code | Status |
|----------|-----------------|------|--------|
| GET /health | api.yaml:348 | apps/api/src/health/health.controller.ts | MATCH |
| GET /auth/login | api.yaml:376 | apps/auth/src/auth.controller.ts | MATCH |
| GET /auth/callback | api.yaml:404 | apps/auth/src/auth.controller.ts | MATCH |
| POST /auth/refresh | api.yaml:465 | apps/auth/src/auth.controller.ts | MATCH |
| POST /auth/logout | api.yaml:517 | apps/auth/src/auth.controller.ts | MATCH |
| GET /auth/me | api.yaml:555 | apps/auth/src/auth.controller.ts | MATCH |
| GET /users/me | api.yaml:581 | apps/auth/src/users.controller.ts | MATCH |
| PATCH /users/me | api.yaml:601 | apps/auth/src/users.controller.ts | MATCH |
| POST /matches | api.yaml:659 | apps/api/src/matches/matches.controller.ts | MATCH |
| GET /matches | api.yaml:717 | apps/api/src/matches/matches.controller.ts | MATCH |
| GET /matches/:matchId | api.yaml:795 | apps/api/src/matches/matches.controller.ts | MATCH |
| PATCH /matches/:matchId | api.yaml:825 | apps/api/src/matches/matches.controller.ts | MATCH |
| DELETE /matches/:matchId | api.yaml:906 | apps/api/src/matches/matches.controller.ts | MATCH |
| POST /matches/:matchId/players | api.yaml:942 | apps/api/src/matches/matches.controller.ts | MATCH |
| POST /matches/:matchId/result | api.yaml:1057 | apps/api/src/matches/matches.controller.ts | MATCH |
| GET /matches/:matchId/confirmations | api.yaml:1173 | apps/api/src/matches/matches.controller.ts | MATCH |
| POST /matches/:matchId/confirmations | api.yaml:1236 | apps/api/src/matches/matches.controller.ts | MATCH |
| POST /matches/:matchId/confirmations/cancel | api.yaml:1304 | apps/api/src/matches/matches.controller.ts | MATCH |
| GET /leaderboard/users | api.yaml:1381 | apps/api/src/leaderboard/leaderboard.controller.ts | MATCH |
| GET /leaderboard/pairs | api.yaml:1458 | apps/api/src/leaderboard/leaderboard.controller.ts | MATCH |
| PATCH /admin/matches/:matchId/result | api.yaml:1538 | apps/api/src/admin/admin.controller.ts | MATCH |
| DELETE /admin/matches/:matchId | api.yaml:1676 | apps/api/src/admin/admin.controller.ts | MATCH |
| GET /admin/matches/:matchId/audit | api.yaml:1718 | apps/api/src/admin/admin.controller.ts | MATCH |
| GET /admin/dlq | api.yaml:1766 | apps/api/src/admin/admin.controller.ts | MATCH |
| POST /admin/dlq/:jobId/retry | api.yaml:1825 | apps/api/src/admin/admin.controller.ts | MATCH |

Critical GAPs: 0
CREEP items: 0

## Schema

| Entity / Field | Schema | Model | Status |
|----------------|--------|-------|--------|
| users | schema.sql:50 | libs/users/src/user.entity.ts | MATCH |
| users.id / azure_oid / email / display_name / is_admin | schema.sql | UserEntity | MATCH |
| refresh_tokens | schema.sql:73 | libs/auth/src/refresh-token.entity.ts | MATCH |
| refresh_tokens.token_hash / expires_at / used_at / replaced_by | schema.sql | RefreshTokenEntity | MATCH |
| matches | schema.sql:113 | libs/matches/src/entities/match.entity.ts | MATCH |
| matches.match_type / status / score_a / score_b / confirmed_at / locked_at / created_by | schema.sql | MatchEntity | MATCH |
| match_players | schema.sql:146 | libs/matches/src/entities/match-player.entity.ts | MATCH |
| match_players.team / slot / position, PK (match_id, user_id) | schema.sql | MatchPlayerEntity | MATCH |
| match_confirmations | schema.sql:177 | libs/matches/src/entities/match-confirmation.entity.ts | MATCH |
| match_confirmations PK (match_id, user_id), confirmed_at | schema.sql | MatchConfirmationEntity | MATCH |
| audit_logs | schema.sql:203 | libs/matches/src/entities/audit-log.entity.ts | MATCH |
| audit_logs.actor_id / action / entity_type / entity_id / before_data / after_data / reason | schema.sql | AuditLogEntity | MATCH |

Critical GAPs: 0
CREEP items: 0

## Components

Not applicable — backend-only project. No ui-components.md exists.

## Design Tokens

Not applicable — no designer/system.md exists.

## Summary

- Critical GAPs: 0
- CREEP items: 0
- Verdict: PASS
