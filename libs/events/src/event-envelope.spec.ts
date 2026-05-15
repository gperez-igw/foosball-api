import type { EventEnvelope } from './event-envelope.js';
import type { MatchConfirmedPayload } from './payloads/match-confirmed.payload.js';

describe('EventEnvelope', () => {
  it('has required fields on a concrete envelope', () => {
    const envelope: EventEnvelope<MatchConfirmedPayload> = {
      eventType: 'match.confirmed',
      version: 1,
      occurredAt: new Date().toISOString(),
      payload: {
        matchId: 1,
        winnerTeam: 'A',
        scoreA: 5,
        scoreB: 3,
        confirmedAt: new Date().toISOString(),
      },
    };

    expect(envelope.version).toBe(1);
    expect(envelope.eventType).toBe('match.confirmed');
    expect(typeof envelope.occurredAt).toBe('string');
    expect(envelope.payload.matchId).toBe(1);
  });

  it('version field is a number', () => {
    const envelope: EventEnvelope<{ id: number }> = {
      eventType: 'test.event',
      version: 2,
      occurredAt: '2026-05-15T00:00:00.000Z',
      payload: { id: 42 },
    };
    expect(typeof envelope.version).toBe('number');
  });
});
