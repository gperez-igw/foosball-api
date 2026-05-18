import { Test } from '@nestjs/testing';
import { MatchesController } from './matches.controller';
import { MatchService } from '@app/matches/services/match.service';
import { ConfirmationService } from '@app/matches/services/confirmation.service';

const mockMatchService = () => ({
  create: jest.fn(),
  list: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  addPlayers: jest.fn(),
  submitResult: jest.fn(),
});

const mockConfirmationService = () => ({
  getStatus: jest.fn(),
  confirm: jest.fn(),
  cancel: jest.fn(),
});

function makeReq(sub: number, is_admin = false) {
  return { user: { sub, is_admin } };
}

describe('MatchesController', () => {
  let controller: MatchesController;
  let matchService: ReturnType<typeof mockMatchService>;
  let confirmationService: ReturnType<typeof mockConfirmationService>;

  beforeEach(async () => {
    matchService = mockMatchService();
    confirmationService = mockConfirmationService();

    const module = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [
        { provide: MatchService, useValue: matchService },
        { provide: ConfirmationService, useValue: confirmationService },
      ],
    }).compile();

    controller = module.get(MatchesController);
  });

  describe('createMatch', () => {
    it('delegates to matchService.create with userId and dto', async () => {
      const dto = { matchType: '2v2' } as any;
      const expected = { id: 1, matchType: '2v2' };
      matchService.create.mockResolvedValue(expected);

      const result = await controller.createMatch(makeReq(42) as any, dto);

      expect(matchService.create).toHaveBeenCalledWith(42, dto);
      expect(result).toBe(expected);
    });
  });

  describe('listMatches', () => {
    it('delegates to matchService.list with query dto', async () => {
      const query = { limit: 10 } as any;
      const expected = { data: [], nextCursor: null };
      matchService.list.mockResolvedValue(expected);

      const result = await controller.listMatches(query);

      expect(matchService.list).toHaveBeenCalledWith(query);
      expect(result).toBe(expected);
    });
  });

  describe('getMatch', () => {
    it('delegates to matchService.findById with parsed matchId', async () => {
      const expected = { id: 7, status: 'draft' };
      matchService.findById.mockResolvedValue(expected);

      const result = await controller.getMatch(7);

      expect(matchService.findById).toHaveBeenCalledWith(7);
      expect(result).toBe(expected);
    });
  });

  describe('updateMatch', () => {
    it('delegates to matchService.update with matchId, userId, dto', async () => {
      const dto = { status: 'open' } as any;
      const expected = { id: 3, status: 'open' };
      matchService.update.mockResolvedValue(expected);

      const result = await controller.updateMatch(makeReq(5) as any, 3, dto);

      expect(matchService.update).toHaveBeenCalledWith(3, 5, dto);
      expect(result).toBe(expected);
    });
  });

  describe('deleteMatch', () => {
    it('delegates to matchService.delete with matchId, userId, is_admin', async () => {
      matchService.delete.mockResolvedValue(undefined);

      await controller.deleteMatch(makeReq(10, true) as any, 99);

      expect(matchService.delete).toHaveBeenCalledWith(99, 10, true);
    });
  });

  describe('addPlayers', () => {
    it('delegates to matchService.addPlayers with matchId, userId, dto', async () => {
      const dto = { players: [] } as any;
      const expected = { id: 2, players: [] };
      matchService.addPlayers.mockResolvedValue(expected);

      const result = await controller.addPlayers(makeReq(1) as any, 2, dto);

      expect(matchService.addPlayers).toHaveBeenCalledWith(2, 1, dto);
      expect(result).toBe(expected);
    });
  });

  describe('submitResult', () => {
    it('delegates to matchService.submitResult with matchId, userId, dto', async () => {
      const dto = { score: [3, 1] } as any;
      const expected = { id: 4, status: 'pending_confirmation' };
      matchService.submitResult.mockResolvedValue(expected);

      const result = await controller.submitResult(makeReq(8) as any, 4, dto);

      expect(matchService.submitResult).toHaveBeenCalledWith(4, 8, dto);
      expect(result).toBe(expected);
    });
  });

  describe('getConfirmationStatus', () => {
    it('delegates to confirmationService.getStatus with matchId', async () => {
      const expected = { matchId: 5, confirmedCount: 2, quorumRequired: 3 };
      confirmationService.getStatus.mockResolvedValue(expected);

      const result = await controller.getConfirmationStatus(5);

      expect(confirmationService.getStatus).toHaveBeenCalledWith(5);
      expect(result).toBe(expected);
    });
  });

  describe('confirmResult', () => {
    it('delegates to confirmationService.confirm with matchId and userId', async () => {
      const expected = { matchId: 6, confirmedCount: 1 };
      confirmationService.confirm.mockResolvedValue(expected);

      const result = await controller.confirmResult(makeReq(3) as any, 6);

      expect(confirmationService.confirm).toHaveBeenCalledWith(6, 3);
      expect(result).toBe(expected);
    });
  });

  describe('cancelConfirmation', () => {
    it('delegates to confirmationService.cancel with matchId and userId', async () => {
      const expected = { matchId: 7, status: 'open' };
      confirmationService.cancel.mockResolvedValue(expected);

      const result = await controller.cancelConfirmation(makeReq(9) as any, 7);

      expect(confirmationService.cancel).toHaveBeenCalledWith(7, 9);
      expect(result).toBe(expected);
    });
  });
});
