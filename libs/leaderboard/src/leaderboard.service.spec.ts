import { Test } from '@nestjs/testing';
import { LeaderboardService, LEADERBOARD_REDIS } from './leaderboard.service';
import { LeaderboardRepository } from './leaderboard.repository';
import type { UserWinEntry, PairWinEntry } from './leaderboard.repository';

const mockLeaderboardRepository = () => ({
  getUserWins: jest.fn(),
  getPairWins: jest.fn(),
});

const mockRedis = () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
});

const USER_ENTRIES: UserWinEntry[] = [
  { userId: 1, displayName: 'User One', wins: 5 },
  { userId: 2, displayName: 'User Two', wins: 3 },
];

const PAIR_ENTRIES: PairWinEntry[] = [
  { userAId: 1, userAName: 'User One', userBId: 2, userBName: 'User Two', wins: 4 },
];

describe('LeaderboardService', () => {
  let service: LeaderboardService;
  let repo: ReturnType<typeof mockLeaderboardRepository>;
  let redis: ReturnType<typeof mockRedis>;

  beforeEach(async () => {
    repo = mockLeaderboardRepository();
    redis = mockRedis();

    const module = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        { provide: LeaderboardRepository, useValue: repo },
        { provide: LEADERBOARD_REDIS, useValue: redis },
      ],
    }).compile();

    service = module.get(LeaderboardService);
  });

  describe('getUserLeaderboard', () => {
    it('returns MISS on cache miss and populates cache', async () => {
      redis.get.mockResolvedValue(null);
      redis.set.mockResolvedValue('OK');
      repo.getUserWins.mockResolvedValue(USER_ENTRIES);

      const result = await service.getUserLeaderboard('week', 20);

      expect(result.cacheStatus).toBe('MISS');
      expect(result.filter).toBe('week');
      expect(result.data).toHaveLength(2);
      expect(result.data[0].rank).toBe(1);
      expect(result.data[0].wins).toBe(5);
      expect(redis.set).toHaveBeenCalled();
    });

    it('returns HIT on cache hit without DB call', async () => {
      const cached = {
        filter: 'week',
        data: [{ rank: 1, userId: 1, displayName: 'User One', wins: 5 }],
        generatedAt: new Date().toISOString(),
      };
      redis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getUserLeaderboard('week', 20);

      expect(result.cacheStatus).toBe('HIT');
      expect(repo.getUserWins).not.toHaveBeenCalled();
    });

    it('returns BYPASS on Redis error and falls back to DB', async () => {
      redis.get.mockRejectedValue(new Error('Redis connection refused'));
      repo.getUserWins.mockResolvedValue(USER_ENTRIES);

      const result = await service.getUserLeaderboard('week', 20);

      expect(result.cacheStatus).toBe('BYPASS');
      expect(repo.getUserWins).toHaveBeenCalled();
    });

    it('applies correct TTL for short filters (week/month = 300s)', async () => {
      redis.get.mockResolvedValue(null);
      redis.set.mockResolvedValue('OK');
      repo.getUserWins.mockResolvedValue([]);

      await service.getUserLeaderboard('week', 20);
      expect(redis.set).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'EX', 300);
    });

    it('applies correct TTL for long filters (year/total = 3600s)', async () => {
      redis.get.mockResolvedValue(null);
      redis.set.mockResolvedValue('OK');
      repo.getUserWins.mockResolvedValue([]);

      await service.getUserLeaderboard('total', 20);
      expect(redis.set).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'EX', 3600);
    });

    it.each(['week', 'month', 'year', 'total'] as const)('returns correct data for filter=%s', async (filter) => {
      redis.get.mockResolvedValue(null);
      redis.set.mockResolvedValue('OK');
      repo.getUserWins.mockResolvedValue(USER_ENTRIES);

      const result = await service.getUserLeaderboard(filter, 20);
      expect(result.filter).toBe(filter);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('getPairLeaderboard', () => {
    it('returns MISS and pair entries with correct shape', async () => {
      redis.get.mockResolvedValue(null);
      redis.set.mockResolvedValue('OK');
      repo.getPairWins.mockResolvedValue(PAIR_ENTRIES);

      const result = await service.getPairLeaderboard('month', 20);

      expect(result.cacheStatus).toBe('MISS');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].rank).toBe(1);
      expect(result.data[0].userA.userId).toBe(1);
      expect(result.data[0].userB.userId).toBe(2);
      expect(result.data[0].wins).toBe(4);
    });

    it('returns HIT when cached', async () => {
      const cached = {
        filter: 'month',
        data: [{ rank: 1, userA: { userId: 1, displayName: 'U1' }, userB: { userId: 2, displayName: 'U2' }, wins: 4 }],
        generatedAt: new Date().toISOString(),
      };
      redis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getPairLeaderboard('month', 20);
      expect(result.cacheStatus).toBe('HIT');
      expect(repo.getPairWins).not.toHaveBeenCalled();
    });

    it('returns BYPASS on Redis error', async () => {
      redis.get.mockRejectedValue(new Error('Redis down'));
      repo.getPairWins.mockResolvedValue(PAIR_ENTRIES);

      const result = await service.getPairLeaderboard('week', 10);
      expect(result.cacheStatus).toBe('BYPASS');
    });
  });

  describe('invalidateCache', () => {
    it('deletes all 8 cache keys when no scopes specified', async () => {
      redis.del.mockResolvedValue(8);
      await service.invalidateCache();
      expect(redis.del).toHaveBeenCalledWith(
        'leaderboard:users:week',
        'leaderboard:users:month',
        'leaderboard:users:year',
        'leaderboard:users:total',
        'leaderboard:pairs:week',
        'leaderboard:pairs:month',
        'leaderboard:pairs:year',
        'leaderboard:pairs:total',
      );
    });

    it('deletes only user keys when scope=users', async () => {
      redis.del.mockResolvedValue(4);
      await service.invalidateCache(['users']);
      expect(redis.del).toHaveBeenCalledWith(
        'leaderboard:users:week',
        'leaderboard:users:month',
        'leaderboard:users:year',
        'leaderboard:users:total',
      );
    });

    it('handles Redis error gracefully during invalidation', async () => {
      redis.del.mockRejectedValue(new Error('Redis unavailable'));
      // Should not throw
      await expect(service.invalidateCache()).resolves.toBeUndefined();
    });
  });
});
