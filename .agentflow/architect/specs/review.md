---
id: review-002
type: review
project: foosball-api
sprint: "01"
created_by: architect
created_at: 2026-05-15
status: approved
requires_decision: false
approved_by: user
approved_at: 2026-05-15 17:35
approval_decision: decision-2026-05-15-1735-specs-approval
topic: Sprint-01 specs ready — approve to start teams
---

# Sprint-01 Specs Review — foosball-api

## Specs Summary

| Spec | Count |
|------|-------|
| api.yaml endpoints | 22 (auth: 5, users: 2, matches: 7, confirmations: 3, leaderboard: 2, admin: 5, health: 1) |
| schema.sql tables | 6 (users, refresh_tokens, matches, match_players, match_confirmations, audit_logs) |
| schema.sql indexes | 17 (unique + composite, covering all leaderboard and FK join patterns) |
| test-criteria.md scenarios | 8 scenarios, 35 Given/When/Then steps across all DoD flows |
| Stack references | 3 files (references/backend-stack.md, database-stack.md, security-stack.md) |

---

## Specs Produced

- `.agentflow/architect/specs/api.yaml` — 22 endpoints, status: draft
- `.agentflow/architect/specs/schema.sql` — 6 tables, full DDL with indexes + FKs, migration sequence documented
- `.agentflow/architect/specs/test-criteria.md` — 8 scenarios (all DoD e2e + unit test matrix + BullMQ event contracts)
- `references/backend-stack.md`, `references/database-stack.md`, `references/security-stack.md` — stack-specific pitfalls for implementers

---

## Spec Validation Report

### api.yaml — Valid OpenAPI 3.0: YES
Issues: none

### schema.sql — Syntactically valid: YES
Issues: none

### Cross-consistency
| Endpoint | Table(s) | Field Check | Result |
|----------|----------|-------------|--------|
| POST /auth/callback | users, refresh_tokens | azure_oid, email, display_name, is_admin, token_hash, expires_at | OK |
| POST /auth/refresh | refresh_tokens | token_hash, used_at, replaced_by | OK |
| POST /auth/logout | refresh_tokens | token_hash, used_at | OK |
| GET /users/me, PATCH /users/me | users | id, email, display_name, is_admin | OK |
| POST /matches | matches | created_by, match_type, status | OK |
| GET /matches, GET /matches/:id | matches, match_players | all fields present | OK |
| PATCH /matches/:id | matches | score_a, score_b, status, updated_at | OK |
| POST /matches/:id/players | match_players | match_id, user_id, team, slot, position | OK |
| POST /matches/:id/result | matches | score_a, score_b, status → awaiting_confirmation | OK |
| POST /matches/:id/confirmations | match_confirmations | match_id, user_id, confirmed_at | OK |
| POST /matches/:id/confirmations/cancel | match_confirmations (DELETE), matches (status) | OK |
| GET /matches/:id/confirmations | match_confirmations, match_players | match_id, user_id, confirmed_at | OK |
| GET /leaderboard/users | matches, match_players, users | status, confirmed_at, user_id | OK |
| GET /leaderboard/pairs | matches, match_players, users | same + team column | OK |
| PATCH /admin/matches/:id/result | matches, audit_logs | score_a/b, before_data, after_data, actor_id, action, entity_type, entity_id | OK |
| DELETE /admin/matches/:id | matches (cascade) | match_players, match_confirmations ON DELETE CASCADE | OK |
| GET /admin/matches/:id/audit | audit_logs | entity_type, entity_id, actor_id | OK |
| GET /admin/dlq, POST /admin/dlq/:jobId/retry | Redis (BullMQ) | no SQL — OK |

### Overall: PASS
Blocking issues: none

---

## Key Technical Decisions in Specs

### Decision 1 — Quorum formula documented explicitly

`quorumRequired = floor(totalPlayers / 2) + 1`
- 1v1 (2 players): quorum = 2 (both must confirm)
- 2v2 (4 players): quorum = 3
- 4v4 (8 players): quorum = 5

This formula is encoded in test-criteria.md and must be implemented identically in
`libs/matches/src/confirmation.service.ts`. **Open question for user**: the briefing
says "metà + 1" (half plus one). Does this mean `ceil(n/2)` or `floor(n/2) + 1`?
For n=4: ceil(4/2)=2, floor(4/2)+1=3. The Architect chose `floor(n/2)+1` (stricter).
**User confirmation recommended** (see Open Questions below).

### Decision 2 — BullMQ event payloads (in test-criteria.md)

Five event types defined with their EventEnvelope<T> payload shapes:
- `match.result_submitted` (v1) — triggers confirmation readiness tracking
- `match.confirmed` (v1) — triggers leaderboard invalidation; includes winnerTeam field
- `match.confirmation_cancelled` (v1)
- `leaderboard-invalidate` (v1) — invalidates all 4 time filters (conservative strategy)
- `audit-log-write` (v1) — CRITICAL: worker writes to audit_logs; failure rolls back admin override

The `winnerTeam: 'A' | 'B' | 'draw'` field in `match.confirmed` is a design decision:
draw is possible if scoreA == scoreB. **If draws count as wins for both teams or as 0
wins for both**, the leaderboard query logic differs. Architect defaulted to 0 wins
for both on draw (draw not counted as a win). **User confirmation recommended.**

### Decision 3 — Audit log: soft FK (no physical FK to matches)

`audit_logs.entity_id` is a soft reference to `matches.id` (no FK constraint).
This ensures audit records are preserved if a match is deleted by an admin.
Physical FK with ON DELETE CASCADE would silently delete audit history on match
deletion — unacceptable for an audit log. ON DELETE RESTRICT would prevent match
deletion if audit records exist — also unacceptable. Soft reference is the only
correct pattern here.

### Decision 4 — Pair leaderboard: all 2-player combinations in 4v4

For 4v4 matches, each unique 2-player pair on the winning team (C(4,2) = 6 combinations)
is independently counted toward the pairs leaderboard. This means a 4v4 win
generates 6 pair win entries. Alternative: only count pairs in 2v2 matches. The
Architect chose the broader definition (all match types contribute to pairs).
**User confirmation recommended** (see Open Questions below).

### Decision 5 — Migration sequence enforced in schema.sql

Phase 1 (backend-auth) must merge before Phase 2 (backend-api) due to FK from
`matches.created_by → users.id`. The PM must enforce PR merge order.
Phase 3 (backend-jobs): no SQL migrations required for MVP — BullMQ persistence
is Redis-native.

---

## Residual Risks (from setup review — addressed here)

### R1 — Migration ordering N>1
**Addressed in schema.sql**: explicit comment block documents Phase 1 → Phase 2 → Phase 3
execution order with per-table assignment to implementer.

### R2 — Jest + `module: nodenext`
**Addressed in test-criteria.md (SCENARIO 8 / M1 validation section)** and in
`references/backend-stack.md`:
- Separate `tsconfig.test.json` with `"module": "CommonJS", "moduleResolution": "node"` required.
- Jest transform must reference `tsconfig.test.json` explicitly via ts-jest config.
- QA must validate this at M1 before any implementer writes tests.
**Note for Architect (post-approval)**: add `tsconfig.test.json` to the monorepo
scaffold (root config file — Architect's file ownership).

### R3 — Swagger + Fastify version pinning
**Noted**: `@nestjs/swagger ^11.0.0` with `@nestjs/platform-fastify ^11.0.1`.
Known compatibility note in `references/backend-stack.md`: do NOT install
`@fastify/swagger` separately — `@nestjs/swagger` registers its own Fastify plugin.
The Architect will pin exact versions in `package.json` during monorepo scaffold
and will issue a patch (patch-001) if a version conflict is discovered.
No blocker identified in the current spec.

---

## Open Questions / Decisions Requested from User

### Q1 — Quorum formula: `floor(n/2) + 1` vs `ceil(n/2)`?
- For 4-player match: floor(4/2)+1 = **3** vs ceil(4/2) = **2**
- Architect chose the stricter `floor(n/2)+1` (majority required, not plurality).
- **Impact**: only on confirmation.service quorum check and test scenario setup.
- **If no preference**: Architect's choice (floor(n/2)+1) stands.

### Q2 — Do draws count as wins for leaderboard?
- If scoreA == scoreB: does it count as a win for both teams? Or 0 wins for both?
- Architect's default: draws count as 0 wins for both teams (excluded from leaderboard).
- **Impact**: leaderboard query WHERE clause and pair computation logic.
- **If no preference**: Architect's default (draw = 0 wins) stands.

### Q3 — Pair leaderboard: 2v2 only, or all match types?
- Option A: count pairs only from 2v2 matches (simple, each team = one pair).
- Option B: count all unique 2-player combinations from any winning team (also counts 4v4 pairs).
- Architect's default: Option B (all match types contribute to pairs leaderboard).
- **Impact**: leaderboard pair query complexity (C(4,2)=6 combinations per 4v4 win).
- **If no preference**: Option B stands.

---

## Next Step

On user approval of this review (all three questions answered or defaults accepted):
1. PM spawns implementers (backend-auth, backend-api, backend-jobs) with file ownership from teams.md.
2. Architect executes monorepo migration (src/ → apps/*) before implementers start.
3. PM coordinates Phase 1 → Phase 2 PR merge order for migrations.
