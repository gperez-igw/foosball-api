---
id: spec-schema-001
type: spec
project: foosball-api
sprint: "01"
created_by: architect
created_at: 2026-05-15
status: approved
requires_decision: false
---

-- =============================================================================
-- foosball-api — MySQL 8 DDL
-- TypeORM migration files must be applied in the sequence documented below.
-- ALL changes go through versioned migration files. synchronize:false enforced.
-- =============================================================================

-- =============================================================================
-- MIGRATION SEQUENCE (required execution order for FK integrity)
-- =============================================================================
-- PHASE 1 — backend-auth  (no FK deps)
--   migrations/XXXXXXXXX-AddUsersTable.ts
--   migrations/XXXXXXXXX-AddRefreshTokensTable.ts
--
-- PHASE 2 — backend-api   (depends on users)
--   migrations/XXXXXXXXX-AddMatchesTable.ts
--   migrations/XXXXXXXXX-AddMatchPlayersTable.ts
--   migrations/XXXXXXXXX-AddMatchConfirmationsTable.ts
--   migrations/XXXXXXXXX-AddAuditLogsTable.ts
--
-- PHASE 3 — backend-jobs  (no DB migrations required for MVP;
--                           BullMQ persistence handled by Redis + bullmq library)
--
-- PM coordinates merge order for Phase 1 → Phase 2 → Phase 3 PRs.
-- Timestamps must be ascending across all migration files.
-- =============================================================================


-- =============================================================================
-- PHASE 1 — backend-auth
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: users
-- Stores every authenticated user. Upserted on each Azure SSO login.
-- azure_oid is the stable Azure Object ID — primary SSO lookup key.
-- is_admin is a DB cache of the Azure AD group membership: synced at login,
-- embedded in JWT payload (no DB call on hot request path).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT,
  azure_oid     VARCHAR(36)         NOT NULL COMMENT 'Azure AD Object ID (UUID format)',
  email         VARCHAR(255)        NOT NULL,
  display_name  VARCHAR(255)        NOT NULL,
  is_admin      TINYINT(1)          NOT NULL DEFAULT 0 COMMENT 'Cache of Azure AD group membership; 0=user 1=admin',
  created_at    DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  UNIQUE INDEX idx_users_azure_oid  (azure_oid)     COMMENT 'O(1) SSO upsert lookup',
  UNIQUE INDEX idx_users_email      (email),
  INDEX        idx_users_is_admin   (is_admin)      COMMENT 'Filter admin users quickly'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- TABLE: refresh_tokens
-- Single-use rotation: each refresh call invalidates the current token and
-- issues a new one. Only the SHA-256 hash of the raw token is stored.
-- used_at IS NULL AND expires_at > NOW() = valid token.
-- replaced_by points to the next token in the chain (NULL if current/terminal).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT,
  user_id       BIGINT UNSIGNED     NOT NULL,
  token_hash    VARCHAR(64)         NOT NULL COMMENT 'SHA-256 hex digest of the raw refresh token',
  expires_at    DATETIME(3)         NOT NULL COMMENT '24h from issuance',
  used_at       DATETIME(3)         NULL     DEFAULT NULL COMMENT 'NULL = still valid; set on rotation',
  replaced_by   BIGINT UNSIGNED     NULL     DEFAULT NULL COMMENT 'FK to the replacement token in chain',
  created_at    DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  UNIQUE INDEX idx_rt_token_hash    (token_hash)    COMMENT 'Lookup by hash on refresh',
  INDEX        idx_rt_user_id       (user_id),
  INDEX        idx_rt_expires       (expires_at)    COMMENT 'Cleanup job for expired tokens',

  CONSTRAINT fk_rt_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_rt_replaced_by
    FOREIGN KEY (replaced_by) REFERENCES refresh_tokens(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- PHASE 2 — backend-api
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: matches
-- A match goes through a strict state machine:
--   draft → playing → awaiting_confirmation → confirmed | cancelled
--
-- score_a / score_b: NULL until result is submitted; UNSIGNED = non-negative.
-- confirmed_at: set when quorum is reached (immutable after this point).
-- locked_at: identical to confirmed_at for MVP; reserved for future use.
-- created_by: soft-references users.id (ON DELETE SET NULL preserves history
--   when an account is deleted by an admin).
-- match_type DEFAULT '2v2' aligns with briefing default.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS matches (
  id            BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT,
  created_by    BIGINT UNSIGNED     NULL     DEFAULT NULL COMMENT 'Creator user_id; NULL if user deleted',
  match_type    ENUM('1v1','2v2','4v4') NOT NULL DEFAULT '2v2',
  status        ENUM('draft','playing','awaiting_confirmation','confirmed','cancelled')
                                    NOT NULL DEFAULT 'draft',
  score_a       TINYINT UNSIGNED    NULL     DEFAULT NULL COMMENT 'Team A score; NULL until result submitted',
  score_b       TINYINT UNSIGNED    NULL     DEFAULT NULL COMMENT 'Team B score; NULL until result submitted',
  created_at    DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  confirmed_at  DATETIME(3)         NULL     DEFAULT NULL COMMENT 'Timestamp when quorum reached; immutable after',
  locked_at     DATETIME(3)         NULL     DEFAULT NULL COMMENT 'Reserved; equals confirmed_at in MVP',

  PRIMARY KEY (id),
  INDEX idx_matches_status_created     (status, created_at)    COMMENT 'Status-filtered list, leaderboard base query',
  INDEX idx_matches_created_by         (created_by),
  INDEX idx_matches_confirmed_at       (confirmed_at)          COMMENT 'Time-filtered leaderboard queries',
  INDEX idx_matches_status_confirmed   (status, confirmed_at)  COMMENT 'Composite for confirmed matches leaderboard',

  CONSTRAINT fk_matches_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- TABLE: match_players
-- Associates users with matches, tracking team (A|B), slot (1-4), and position.
-- Unique index on (match_id, user_id) prevents duplicate player registration.
-- Unique index on (match_id, team, slot) prevents slot collisions.
-- Capacity rules enforced at application layer (1v1=2 players, 2v2=4, 4v4=8).
-- position is optional (e.g. 'goalkeeper', 'striker') — stored for display only.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS match_players (
  match_id      BIGINT UNSIGNED     NOT NULL,
  user_id       BIGINT UNSIGNED     NOT NULL,
  team          ENUM('A','B')       NOT NULL,
  slot          TINYINT UNSIGNED    NOT NULL COMMENT '1-based slot within team (max 4)',
  position      VARCHAR(64)         NULL     DEFAULT NULL COMMENT 'Optional display label',

  PRIMARY KEY (match_id, user_id),
  UNIQUE INDEX idx_mp_match_team_slot (match_id, team, slot) COMMENT 'No slot collision within team',
  INDEX        idx_mp_user_id         (user_id)              COMMENT 'All matches for a player',

  CONSTRAINT fk_mp_match
    FOREIGN KEY (match_id) REFERENCES matches(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_mp_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,

  CONSTRAINT chk_mp_slot CHECK (slot BETWEEN 1 AND 4)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- TABLE: match_confirmations
-- Tracks which players have confirmed a match result.
-- Used to compute quorum: confirmed_count >= ceil(total_players / 2) + 1.
-- When the match creator cancels confirmation, ALL rows for that match_id are
-- deleted (reset to 0 confirmations). The match status reverts to 'playing'.
-- Unique index enforces one confirmation vote per player per match.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS match_confirmations (
  match_id      BIGINT UNSIGNED     NOT NULL,
  user_id       BIGINT UNSIGNED     NOT NULL,
  confirmed_at  DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (match_id, user_id),

  CONSTRAINT fk_mc_match
    FOREIGN KEY (match_id) REFERENCES matches(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_mc_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- TABLE: audit_logs
-- Append-only. Records every admin override of a confirmed match result.
-- entity_id has NO physical FK to matches(id) to preserve the audit trail
-- even if the referenced match is later deleted by an admin.
-- actor_id references users.id (ON DELETE SET NULL preserves record on user deletion).
-- before_data / after_data: JSON snapshots of the changed fields.
-- reason: optional admin note (required in practice by the UI).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id            BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT,
  actor_id      BIGINT UNSIGNED     NULL     DEFAULT NULL COMMENT 'Admin who performed the action; NULL if user deleted',
  action        VARCHAR(64)         NOT NULL COMMENT 'e.g. result_override, match_delete, score_correct',
  entity_type   VARCHAR(64)         NOT NULL COMMENT 'Always ''match'' for MVP',
  entity_id     BIGINT UNSIGNED     NOT NULL COMMENT 'Soft reference to matches.id (no FK)',
  before_data   JSON                NOT NULL COMMENT 'Snapshot of changed fields before override',
  after_data    JSON                NOT NULL COMMENT 'Snapshot of changed fields after override',
  reason        TEXT                NULL     DEFAULT NULL COMMENT 'Admin note; optional but recommended',
  created_at    DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  INDEX idx_audit_entity            (entity_type, entity_id)  COMMENT 'Fetch audit trail for a match',
  INDEX idx_audit_actor             (actor_id)                COMMENT 'All actions by an admin',
  INDEX idx_audit_created_at        (created_at)              COMMENT 'Chronological audit report',

  CONSTRAINT fk_audit_actor
    FOREIGN KEY (actor_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- PHASE 3 — backend-jobs
-- =============================================================================
-- BullMQ persistence is handled entirely by Redis (BullMQ library internals).
-- No MySQL tables required for queue jobs in MVP.
-- If a durable job store is needed in the future (e.g., scheduled match reminders
-- persisted across Redis restarts), a `scheduled_jobs` table will be added via
-- a Phase 3 migration. Decision deferred to sprint-02.

-- =============================================================================
-- SUPPLEMENTARY: LEADERBOARD QUERY NOTES
-- =============================================================================
-- Leaderboard (wins per user, time-filtered):
--   SELECT u.id, u.display_name, COUNT(*) AS wins
--   FROM matches m
--   JOIN match_players mp ON mp.match_id = m.id
--   JOIN match_players mp_winner ON mp_winner.match_id = m.id AND mp_winner.team = (
--     CASE WHEN m.score_a > m.score_b THEN 'A' ELSE 'B' END
--   )
--   JOIN users u ON u.id = mp_winner.user_id
--   WHERE m.status = 'confirmed'
--     AND m.confirmed_at >= :startDate   -- time filter applied here
--   GROUP BY u.id
--   ORDER BY wins DESC
--   LIMIT :limit
--
--   Uses: idx_matches_status_confirmed + idx_mp_user_id
--
-- Leaderboard (wins per pair):
--   Two-player pairs are identified by ordering the two user IDs (user_a < user_b)
--   for same-team players in 2v2 matches. Application layer computes pair key.
--
-- Redis cache sits in front of both queries.
-- TTL: 300s (week/month), 3600s (year/total).
-- Invalidated via BullMQ event leaderboard-invalidate on match confirmed.
-- =============================================================================
