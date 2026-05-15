// EventEnvelope<T> — typed wrapper for all BullMQ job payloads.
// Owner: backend-jobs
// IMPORTANT: consumers MUST check `version` before destructuring `payload`.
export interface EventEnvelope<T> {
  /** Dot-namespaced event type, e.g. 'match.confirmed' */
  eventType: string;
  /** Starts at 1; increment on breaking payload change. */
  version: number;
  /** ISO-8601 timestamp when the event occurred. */
  occurredAt: string;
  payload: T;
}
