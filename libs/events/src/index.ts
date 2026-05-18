// Re-exports for consumption from other apps and libs.
// Note: .js extensions are used for nodenext module resolution in production builds.
// ts-jest resolves these correctly when moduleResolution is set to 'node' in tsconfig.test.json.
export { QUEUE_MATCHES, QUEUE_LEADERBOARD, QUEUE_AUDIT } from './queue-names.js';
export type { EventEnvelope } from './event-envelope.js';
export { defaultJobOptions } from './queue-config.js';
export type { MatchConfirmedPayload } from './payloads/match-confirmed.payload.js';
export type { MatchResultSubmittedPayload } from './payloads/match-result-submitted.payload.js';
export type { MatchCancelledPayload } from './payloads/match-cancelled.payload.js';
export type { LeaderboardInvalidatePayload } from './payloads/leaderboard-invalidate.payload.js';
export type { AuditLogPayload } from './payloads/audit-log.payload.js';
export { DlqInspectorService } from './dlq-inspector.service.js';
export type { DlqJob } from './dlq-inspector.service.js';
export { DlqInspectorModule } from './dlq-inspector.module.js';
