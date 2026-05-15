# Database Stack Reference — foosball-api

Stack: MySQL 8 + TypeORM 0.3.x + Redis 7 (BullMQ + cache)

---

## TypeORM Migrations

### Correct: generate migration from entity diff

```bash
npx typeorm migration:generate migrations/AddUsersTable -d dist/libs/database/src/data-source.js
```

### Correct: migration file structure (UP/DOWN)

```typescript
export class AddUsersTable1715800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE users (...)`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
  }
}
```

### Anti-pattern: migrations with no DOWN method

```typescript
// WRONG — rollback becomes impossible; blocks recovery in staging/production
public async down(): Promise<void> {} // empty
```

### Anti-pattern: running migrations out of order

```
// WRONG — FKs from matches.created_by → users.id will fail if users table doesn't exist yet
// Required order: users → refresh_tokens → matches → match_players → match_confirmations → audit_logs
```

---

## MySQL Constraints

### Correct: CHECK constraint for enum-like columns

```sql
match_type ENUM('1v1', '2v2', '4v4') NOT NULL DEFAULT '2v2'
-- OR if ENUM not desired:
match_type VARCHAR(8) NOT NULL DEFAULT '2v2',
CONSTRAINT chk_match_type CHECK (match_type IN ('1v1', '2v2', '4v4'))
```

### Correct: non-negative score constraint

```sql
score_a TINYINT UNSIGNED NULL,
score_b TINYINT UNSIGNED NULL
-- UNSIGNED enforces >= 0 at DB level
```

### Anti-pattern: signed INT for scores without constraint

```sql
// WRONG — allows negative scores without application-layer check
score_a INT NULL
```

---

## Indexes for leaderboard queries

### Correct: composite index for time-filtered leaderboard

```sql
-- Leaderboard counts wins per user filtered by confirmed_at + status
INDEX idx_matches_status_confirmed (status, confirmed_at)
-- Match player lookup
INDEX idx_match_players_user (user_id)
-- Confirmation quorum check
UNIQUE INDEX idx_confirmations_match_user (match_id, user_id)
```

### Anti-pattern: relying on FK index for all joins

```
// WRONG — FK creates only a single-column index on the FK column.
// Composite index (match_id, user_id) is different from (match_id) + (user_id) separately.
```

---

## Pagination (cursor-based)

### Correct: cursor-based with WHERE clause

```sql
-- cursor encodes (created_at, id) pair
SELECT * FROM matches
WHERE status = 'confirmed'
  AND (created_at, id) < (:cursorAt, :cursorId)
ORDER BY created_at DESC, id DESC
LIMIT 20
```

### Anti-pattern: OFFSET-based pagination

```sql
-- WRONG — O(n) scan for large offsets; results shift when rows are inserted
SELECT * FROM matches LIMIT 20 OFFSET 400
```

---

## JSON columns (audit_log)

### Correct: JSON column for before/after snapshots

```sql
before_data JSON NOT NULL,
after_data  JSON NOT NULL
-- MySQL 8 validates JSON on insert; use JSON_VALID() check if needed
```

### Anti-pattern: TEXT column for structured data

```sql
before_data TEXT -- WRONG — no JSON validation, no JSON_EXTRACT indexing
```

---

## Redis (BullMQ + cache)

### Correct: separate Redis connections for BullMQ and cache

```typescript
// BullMQ uses ioredis via BullModule.forRoot({ connection: { host, port } })
// Cache uses a separate ioredis client — do NOT share the BullMQ connection
const cacheClient = new Redis({ host, port, db: 1 }); // different DB index
```

### Anti-pattern: sharing one Redis connection between BullMQ and cache

```
// WRONG — BullMQ uses SUBSCRIBE internally; a shared connection blocks cache ops
```

### Cache key format

```
leaderboard:users:week    — leaderboard:users:{filter}
leaderboard:pairs:month   — leaderboard:pairs:{filter}
TTL: 300s (5 min) for week/month; 3600s (1 hour) for year/total
```

### Anti-pattern: saving signed URLs or tokens in cache

```
// WRONG — JWT tokens or Azure MSAL tokens must never be stored in Redis cache
// Redis is not a session store in this project
```

---

## Refresh tokens (MySQL)

### Correct: hash the token before storing

```typescript
const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
// Store tokenHash in refresh_tokens.token_hash — never the raw token
```

### Anti-pattern: storing raw refresh token in DB

```sql
-- WRONG — DB breach exposes tokens directly
token VARCHAR(512) NOT NULL -- store hash instead
```

### Single-use rotation pattern

```sql
-- On refresh:
-- 1. SELECT WHERE token_hash = :hash AND used_at IS NULL AND expires_at > NOW()
-- 2. UPDATE SET used_at = NOW(), replaced_by = :newTokenId
-- 3. INSERT new token record
-- If step 1 returns 0 rows: return 401 INVALID_REFRESH_TOKEN
```
