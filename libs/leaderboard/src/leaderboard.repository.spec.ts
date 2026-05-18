import { LeaderboardRepository } from './leaderboard.repository';
import type { TimeFilter } from './dto/leaderboard-query.dto';

// ──────────────────────────────────────────────────────────────────────────────
// DataSource mock factory
// ──────────────────────────────────────────────────────────────────────────────

function makeDataSource(rows: any[] = []) {
  return {
    query: jest.fn().mockResolvedValue(rows),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Raw row factories (simulate MySQL result shape)
// ──────────────────────────────────────────────────────────────────────────────

function rawUserRow(userId: number, displayName: string, wins: number) {
  return { userId: String(userId), displayName, wins: String(wins) };
}

function rawPairRow(
  userAId: number,
  userAName: string,
  userBId: number,
  userBName: string,
  wins: number,
) {
  return {
    userAId: String(userAId),
    userAName,
    userBId: String(userBId),
    userBName,
    wins: String(wins),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe('LeaderboardRepository', () => {
  // ── getUserWins ────────────────────────────────────────────────────────────

  describe('getUserWins', () => {
    it('returns mapped UserWinEntry array with correct numeric types', async () => {
      const rows = [rawUserRow(1, 'Alice', 10), rawUserRow(2, 'Bob', 7)];
      const ds = makeDataSource(rows);
      const repo = new LeaderboardRepository(ds as any);

      const result = await repo.getUserWins('total', 20);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ userId: 1, displayName: 'Alice', wins: 10 });
      expect(result[1]).toEqual({ userId: 2, displayName: 'Bob', wins: 7 });
    });

    it('returns empty array when no confirmed matches', async () => {
      const ds = makeDataSource([]);
      const repo = new LeaderboardRepository(ds as any);

      const result = await repo.getUserWins('week', 10);
      expect(result).toEqual([]);
    });

    it('does NOT add date param when filter=total', async () => {
      const ds = makeDataSource([]);
      const repo = new LeaderboardRepository(ds as any);

      await repo.getUserWins('total', 20);

      const [sql, params] = ds.query.mock.calls[0];
      // Only the LIMIT param should be present (no date)
      expect(params).toHaveLength(1);
      expect(sql).not.toContain('confirmed_at >=');
    });

    it.each(['week', 'month', 'year'] as TimeFilter[])(
      'adds date param for filter=%s',
      async (filter) => {
        const ds = makeDataSource([]);
        const repo = new LeaderboardRepository(ds as any);

        await repo.getUserWins(filter, 20);

        const [sql, params] = ds.query.mock.calls[0];
        expect(params).toHaveLength(2);
        expect(params[0]).toBeInstanceOf(Date);
        expect(sql).toContain('confirmed_at >=');
      },
    );

    it('week filter sets a date ~7 days in the past', async () => {
      const before = new Date();
      const ds = makeDataSource([]);
      const repo = new LeaderboardRepository(ds as any);

      await repo.getUserWins('week', 20);

      const after = new Date();
      const [, params] = ds.query.mock.calls[0];
      const startDate: Date = params[0];

      // The date should be approximately now-7 days
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(startDate.getTime()).toBeGreaterThanOrEqual(before.getTime() - sevenDaysMs - 100);
      expect(startDate.getTime()).toBeLessThanOrEqual(after.getTime() - sevenDaysMs + 100);
    });

    it('month filter sets a date ~30 days in the past', async () => {
      const before = new Date();
      const ds = makeDataSource([]);
      const repo = new LeaderboardRepository(ds as any);

      await repo.getUserWins('month', 20);

      const after = new Date();
      const [, params] = ds.query.mock.calls[0];
      const startDate: Date = params[0];

      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      expect(startDate.getTime()).toBeGreaterThanOrEqual(before.getTime() - thirtyDaysMs - 100);
      expect(startDate.getTime()).toBeLessThanOrEqual(after.getTime() - thirtyDaysMs + 100);
    });

    it('year filter sets a date ~365 days in the past', async () => {
      const before = new Date();
      const ds = makeDataSource([]);
      const repo = new LeaderboardRepository(ds as any);

      await repo.getUserWins('year', 20);

      const after = new Date();
      const [, params] = ds.query.mock.calls[0];
      const startDate: Date = params[0];

      const yearMs = 365 * 24 * 60 * 60 * 1000;
      expect(startDate.getTime()).toBeGreaterThanOrEqual(before.getTime() - yearMs - 100);
      expect(startDate.getTime()).toBeLessThanOrEqual(after.getTime() - yearMs + 100);
    });

    it('passes limit as last param', async () => {
      const ds = makeDataSource([]);
      const repo = new LeaderboardRepository(ds as any);

      await repo.getUserWins('total', 50);

      const [, params] = ds.query.mock.calls[0];
      expect(params[params.length - 1]).toBe(50);
    });

    it('respects limit parameter in SQL', async () => {
      const ds = makeDataSource([]);
      const repo = new LeaderboardRepository(ds as any);

      await repo.getUserWins('total', 5);

      const [sql] = ds.query.mock.calls[0];
      expect(sql).toContain('LIMIT ?');
    });
  });

  // ── getPairWins ────────────────────────────────────────────────────────────

  describe('getPairWins', () => {
    it('returns mapped PairWinEntry array with correct numeric types', async () => {
      const rows = [rawPairRow(1, 'Alice', 2, 'Bob', 8)];
      const ds = makeDataSource(rows);
      const repo = new LeaderboardRepository(ds as any);

      const result = await repo.getPairWins('total', 20);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        userAId: 1,
        userAName: 'Alice',
        userBId: 2,
        userBName: 'Bob',
        wins: 8,
      });
    });

    it('returns empty array when no pair wins', async () => {
      const ds = makeDataSource([]);
      const repo = new LeaderboardRepository(ds as any);

      const result = await repo.getPairWins('month', 10);
      expect(result).toEqual([]);
    });

    it('does NOT add date param when filter=total', async () => {
      const ds = makeDataSource([]);
      const repo = new LeaderboardRepository(ds as any);

      await repo.getPairWins('total', 20);

      const [sql, params] = ds.query.mock.calls[0];
      expect(params).toHaveLength(1);
      expect(sql).not.toContain('confirmed_at >=');
    });

    it.each(['week', 'month', 'year'] as TimeFilter[])(
      'adds date param for filter=%s',
      async (filter) => {
        const ds = makeDataSource([]);
        const repo = new LeaderboardRepository(ds as any);

        await repo.getPairWins(filter, 20);

        const [sql, params] = ds.query.mock.calls[0];
        expect(params).toHaveLength(2);
        expect(params[0]).toBeInstanceOf(Date);
        expect(sql).toContain('confirmed_at >=');
      },
    );

    it('passes limit as last param', async () => {
      const ds = makeDataSource([]);
      const repo = new LeaderboardRepository(ds as any);

      await repo.getPairWins('total', 15);

      const [, params] = ds.query.mock.calls[0];
      expect(params[params.length - 1]).toBe(15);
    });

    it('returns multiple pairs sorted by wins descending (as returned by DB)', async () => {
      const rows = [
        rawPairRow(1, 'Alice', 2, 'Bob', 12),
        rawPairRow(3, 'Carol', 4, 'Dave', 9),
        rawPairRow(5, 'Eve', 6, 'Frank', 3),
      ];
      const ds = makeDataSource(rows);
      const repo = new LeaderboardRepository(ds as any);

      const result = await repo.getPairWins('year', 10);

      expect(result).toHaveLength(3);
      expect(result[0].wins).toBe(12);
      expect(result[1].wins).toBe(9);
      expect(result[2].wins).toBe(3);
    });
  });
});
