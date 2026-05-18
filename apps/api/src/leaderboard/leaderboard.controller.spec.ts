import { Test } from '@nestjs/testing';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from '@app/leaderboard/leaderboard.service';

const mockLeaderboardService = () => ({
  getUserLeaderboard: jest.fn(),
  getPairLeaderboard: jest.fn(),
});

function makeReply() {
  return { header: jest.fn() };
}

describe('LeaderboardController', () => {
  let controller: LeaderboardController;
  let leaderboardService: ReturnType<typeof mockLeaderboardService>;

  beforeEach(async () => {
    leaderboardService = mockLeaderboardService();

    const module = await Test.createTestingModule({
      controllers: [LeaderboardController],
      providers: [
        { provide: LeaderboardService, useValue: leaderboardService },
      ],
    }).compile();

    controller = module.get(LeaderboardController);
  });

  describe('getLeaderboardUsers', () => {
    it('defaults filter to total and limit to 20 when not provided', async () => {
      const serviceResult = {
        filter: 'total',
        data: [{ rank: 1, userId: 1, displayName: 'Alice', wins: 10 }],
        generatedAt: '2026-05-18T00:00:00.000Z',
        cacheStatus: 'MISS',
      };
      leaderboardService.getUserLeaderboard.mockResolvedValue(serviceResult);
      const reply = makeReply();

      const result = await controller.getLeaderboardUsers({} as any, reply as any);

      expect(leaderboardService.getUserLeaderboard).toHaveBeenCalledWith('total', 20);
      expect(reply.header).toHaveBeenCalledWith('X-Cache', 'MISS');
      expect(result).toEqual({
        filter: 'total',
        data: serviceResult.data,
        generatedAt: serviceResult.generatedAt,
      });
    });

    it('passes provided filter and limit to the service', async () => {
      const serviceResult = {
        filter: 'week',
        data: [],
        generatedAt: '2026-05-18T00:00:00.000Z',
        cacheStatus: 'HIT',
      };
      leaderboardService.getUserLeaderboard.mockResolvedValue(serviceResult);
      const reply = makeReply();

      await controller.getLeaderboardUsers({ filter: 'week', limit: 5 } as any, reply as any);

      expect(leaderboardService.getUserLeaderboard).toHaveBeenCalledWith('week', 5);
      expect(reply.header).toHaveBeenCalledWith('X-Cache', 'HIT');
    });

    it('sets X-Cache BYPASS header when cache is bypassed', async () => {
      const serviceResult = {
        filter: 'month',
        data: [],
        generatedAt: '2026-05-18T00:00:00.000Z',
        cacheStatus: 'BYPASS',
      };
      leaderboardService.getUserLeaderboard.mockResolvedValue(serviceResult);
      const reply = makeReply();

      await controller.getLeaderboardUsers({ filter: 'month', limit: 10 } as any, reply as any);

      expect(reply.header).toHaveBeenCalledWith('X-Cache', 'BYPASS');
    });

    it('strips cacheStatus from the returned body', async () => {
      const serviceResult = {
        filter: 'year',
        data: [],
        generatedAt: '2026-05-18T00:00:00.000Z',
        cacheStatus: 'HIT',
      };
      leaderboardService.getUserLeaderboard.mockResolvedValue(serviceResult);
      const reply = makeReply();

      const result = await controller.getLeaderboardUsers({ filter: 'year', limit: 20 } as any, reply as any);

      expect((result as Record<string, unknown>).cacheStatus).toBeUndefined();
    });
  });

  describe('getLeaderboardPairs', () => {
    it('defaults filter to total and limit to 20 when not provided', async () => {
      const serviceResult = {
        filter: 'total',
        data: [],
        generatedAt: '2026-05-18T00:00:00.000Z',
        cacheStatus: 'MISS',
      };
      leaderboardService.getPairLeaderboard.mockResolvedValue(serviceResult);
      const reply = makeReply();

      const result = await controller.getLeaderboardPairs({} as any, reply as any);

      expect(leaderboardService.getPairLeaderboard).toHaveBeenCalledWith('total', 20);
      expect(reply.header).toHaveBeenCalledWith('X-Cache', 'MISS');
      expect(result).toEqual({
        filter: 'total',
        data: serviceResult.data,
        generatedAt: serviceResult.generatedAt,
      });
    });

    it('passes provided filter and limit to the service', async () => {
      const serviceResult = {
        filter: 'week',
        data: [],
        generatedAt: '2026-05-18T00:00:00.000Z',
        cacheStatus: 'HIT',
      };
      leaderboardService.getPairLeaderboard.mockResolvedValue(serviceResult);
      const reply = makeReply();

      await controller.getLeaderboardPairs({ filter: 'week', limit: 3 } as any, reply as any);

      expect(leaderboardService.getPairLeaderboard).toHaveBeenCalledWith('week', 3);
    });

    it('strips cacheStatus from the returned body', async () => {
      const serviceResult = {
        filter: 'total',
        data: [],
        generatedAt: '2026-05-18T00:00:00.000Z',
        cacheStatus: 'BYPASS',
      };
      leaderboardService.getPairLeaderboard.mockResolvedValue(serviceResult);
      const reply = makeReply();

      const result = await controller.getLeaderboardPairs({} as any, reply as any);

      expect((result as Record<string, unknown>).cacheStatus).toBeUndefined();
    });
  });
});
