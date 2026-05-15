import { Injectable, Logger, Inject } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { LeaderboardRepository, UserWinEntry, PairWinEntry } from './leaderboard.repository.js';
import { TimeFilter } from './dto/leaderboard-query.dto.js';

export const LEADERBOARD_REDIS = 'LEADERBOARD_REDIS';

const CACHE_TTL: Record<TimeFilter, number> = {
  week: 300,
  month: 300,
  year: 3600,
  total: 3600,
};

export type CacheStatus = 'HIT' | 'MISS' | 'BYPASS';

export interface LeaderboardUsersResult {
  filter: TimeFilter;
  data: Array<{ rank: number; userId: number; displayName: string; wins: number }>;
  generatedAt: string;
  cacheStatus: CacheStatus;
}

export interface LeaderboardPairsResult {
  filter: TimeFilter;
  data: Array<{
    rank: number;
    userA: { userId: number; displayName: string };
    userB: { userId: number; displayName: string };
    wins: number;
  }>;
  generatedAt: string;
  cacheStatus: CacheStatus;
}

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    private readonly leaderboardRepository: LeaderboardRepository,
    @Inject(LEADERBOARD_REDIS) private readonly redis: Redis,
  ) {}

  private cacheKey(scope: 'users' | 'pairs', filter: TimeFilter): string {
    return `leaderboard:${scope}:${filter}`;
  }

  async getUserLeaderboard(filter: TimeFilter, limit: number): Promise<LeaderboardUsersResult> {
    const key = this.cacheKey('users', filter);
    const generatedAt = new Date().toISOString();

    try {
      const cached = await this.redis.get(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        return { ...parsed, cacheStatus: 'HIT' as CacheStatus };
      }
    } catch (err) {
      this.logger.warn('Redis unavailable, falling back to direct query');
      const data = await this.leaderboardRepository.getUserWins(filter, limit);
      return {
        filter,
        data: data.map((entry, i) => ({ rank: i + 1, ...entry })),
        generatedAt,
        cacheStatus: 'BYPASS',
      };
    }

    const data = await this.leaderboardRepository.getUserWins(filter, limit);
    const result = {
      filter,
      data: data.map((entry, i) => ({ rank: i + 1, ...entry })),
      generatedAt,
    };

    try {
      await this.redis.set(key, JSON.stringify(result), 'EX', CACHE_TTL[filter]);
    } catch (err) {
      this.logger.warn('Failed to write to Redis cache');
    }

    return { ...result, cacheStatus: 'MISS' };
  }

  async getPairLeaderboard(filter: TimeFilter, limit: number): Promise<LeaderboardPairsResult> {
    const key = this.cacheKey('pairs', filter);
    const generatedAt = new Date().toISOString();

    try {
      const cached = await this.redis.get(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        return { ...parsed, cacheStatus: 'HIT' as CacheStatus };
      }
    } catch (err) {
      this.logger.warn('Redis unavailable, falling back to direct query');
      const data = await this.leaderboardRepository.getPairWins(filter, limit);
      return {
        filter,
        data: data.map((entry, i) => ({
          rank: i + 1,
          userA: { userId: entry.userAId, displayName: entry.userAName },
          userB: { userId: entry.userBId, displayName: entry.userBName },
          wins: entry.wins,
        })),
        generatedAt,
        cacheStatus: 'BYPASS',
      };
    }

    const data = await this.leaderboardRepository.getPairWins(filter, limit);
    const result = {
      filter,
      data: data.map((entry, i) => ({
        rank: i + 1,
        userA: { userId: entry.userAId, displayName: entry.userAName },
        userB: { userId: entry.userBId, displayName: entry.userBName },
        wins: entry.wins,
      })),
      generatedAt,
    };

    try {
      await this.redis.set(key, JSON.stringify(result), 'EX', CACHE_TTL[filter]);
    } catch (err) {
      this.logger.warn('Failed to write to Redis cache');
    }

    return { ...result, cacheStatus: 'MISS' };
  }

  async invalidateCache(scopes?: Array<'users' | 'pairs'>): Promise<void> {
    const filters: TimeFilter[] = ['week', 'month', 'year', 'total'];
    const targetScopes = scopes ?? ['users', 'pairs'];

    const keys = targetScopes.flatMap((scope) => filters.map((f) => this.cacheKey(scope, f)));

    try {
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (err) {
      this.logger.warn('Failed to invalidate leaderboard cache');
    }
  }
}
