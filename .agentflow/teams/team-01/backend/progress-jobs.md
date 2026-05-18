---
id: progress-backend-jobs-sprint-01
type: progress
project: foosball-api
sprint: "01"
team: team-01
created_by: backend-jobs
created_at: 2026-05-18
status: milestone-ready
requires_decision: false
---

# Backend-Jobs Progress — Sprint-01

## Summary

All 3 remaining delta tasks completed. Build clean. 17 tests pass (0 failures).

---

## Tasks Completed

### Task 1 — AuditLogProcessor: DB persistence + TypeOrmModule in worker

**Files modified:**
- `apps/worker/src/processors/audit-log.processor.ts` — injected `Repository<AuditLogEntity>` via `@InjectRepository`; `process()` now calls `repository.create()` + `repository.save()` to persist the audit_log row. Added `@Injectable()` decorator required for DI.
- `apps/worker/src/app.module.ts` — added `ConfigModule.forRoot()` + `TypeOrmModule.forRootAsync()` (MySQL, config via ConfigService) + `TypeOrmModule.forFeature([AuditLogEntity])`. Worker now has a full DB connection and the `AuditLogEntity` repository is available for injection.

**Spec ref:** audit-log.processor section in architecture.md; `QUEUE_AUDIT` consumer in test-criteria.md BullMQ contracts.

### Task 2 — AuditLogProcessor unit test

**File created:**
- `apps/worker/src/processors/audit-log.processor.spec.ts`

**Tests (6 passing):**
- `process()` — persists audit log on valid v1 job (verifies `create` + `save` called with correct fields)
- `process()` — sets reason to null when payload reason is null
- `process()` — throws on version mismatch, does NOT call `save` (DLQ path)
- `process()` — propagates DB save error so BullMQ retries
- `onFailed()` — logs DLQ message when all retries exhausted
- `onFailed()` — does NOT log DLQ message when retries remain

**Spec ref:** test-criteria.md §backend-jobs unit tests; audit-log-write BullMQ contract.

### Task 3 — DlqInspectorService in libs/events

**Files created:**
- `libs/events/src/dlq-inspector.service.ts` — `DlqInspectorService` with:
  - `listFailed(queueName?: string): Promise<DlqJob[]>` — wraps `queue.getFailed()`; if `queueName` omitted, aggregates across all 3 queues (matches, leaderboard, audit).
  - `retryJob(queueName: string, jobId: string): Promise<void>` — wraps `queue.getJob(jobId).retry('failed')`.
  - `DlqJob` interface: `{ id, name, queue, failedReason, attemptsMade, timestamp, data }`.
- `libs/events/src/dlq-inspector.module.ts` — `DlqInspectorModule` that registers the 3 queues and provides/exports `DlqInspectorService`.

**File modified:**
- `libs/events/src/index.ts` — exports `DlqInspectorService`, `DlqJob` (type), `DlqInspectorModule`.

**Spec ref:** audit section 3.4 in sprint-01-audit.md; backend-api AdminController DLQ endpoints.

### Fix — Jest `.js` extension resolution (pre-existing blocker)

**File modified:** `package.json` (jest `moduleNameMapper`)

All `apps/worker` and `apps/producer` specs were pre-broken because Jest's CommonJS resolver (`moduleResolution: node`) cannot resolve relative `.js` imports in TypeScript source (files are `.ts`). Added two mapper entries:
- `"^(\\.{1,2}/.+)\\.js$": "$1"` — strips `.js` from relative imports
- Per-lib `.js`-aware matchers (e.g. `"@app/matches/(.+)\\.js$": "<rootDir>/libs/matches/src/$1"`) — strips `.js` from `@app/*` subpath imports

This fixes all 5 spec files in apps/worker and apps/producer that were previously failing.

---

## Build Results

```
npm run build:worker   → SUCCESS (0 errors)
npm run build:producer → SUCCESS (0 errors)
```

## Test Results

```
npx jest libs/events apps/worker apps/producer

Test Suites: 5 passed, 5 total
Tests:       17 passed, 17 total

Breakdown:
  libs/events/src/event-envelope.spec.ts                        2 passed
  apps/worker/src/processors/match-confirmed.processor.spec.ts  4 passed
  apps/worker/src/processors/leaderboard-invalidate.processor.spec.ts  3 passed
  apps/worker/src/processors/audit-log.processor.spec.ts        6 passed
  apps/producer/src/schedulers/leaderboard-cron.service.spec.ts 2 passed
```

---

## Cross-Area Notes (for backend-api)

`DlqInspectorService` and `DlqInspectorModule` are now exported from `@app/events`.

To wire into `AdminController`:
```typescript
// In apps/api AppModule imports:
import { DlqInspectorModule } from '@app/events';
// Also needs BullModule.forRoot() to be present (already is in AppModule)

// In AdminController constructor:
constructor(private readonly dlqInspector: DlqInspectorService) {}

// listDlqJobs():
const jobs = await this.dlqInspector.listFailed(queueName);

// retryDlqJob(jobId, queueName):
await this.dlqInspector.retryJob(queueName, jobId);
```

The `DlqInspectorModule` internally registers all 3 queues — backend-api just needs to import the module (no duplicate queue registration needed if the BullMQ root is already configured in AppModule).

---

## Blockers

None.
