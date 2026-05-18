import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { MatchService } from './match.service';
import { MatchRepository } from '../repositories/match.repository';
import { QUEUE_MATCHES } from '@app/events';
import type { MatchEntity } from '../entities/match.entity';
import type { MatchPlayerEntity } from '../entities/match-player.entity';

const mockMatchRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findById: jest.fn(),
  findPaginated: jest.fn(),
  findPlayers: jest.fn(),
  savePlayers: jest.fn(),
  delete: jest.fn(),
});

const mockQueue = () => ({
  add: jest.fn().mockResolvedValue(undefined),
});

function makeMatch(overrides: Partial<MatchEntity> = {}): MatchEntity {
  return {
    id: 1,
    createdBy: 10,
    matchType: '2v2',
    status: 'draft',
    scoreA: null,
    scoreB: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    confirmedAt: null,
    lockedAt: null,
    players: [],
    confirmations: [],
    ...overrides,
  } as unknown as MatchEntity;
}

function makePlayer(overrides: Partial<MatchPlayerEntity> = {}): MatchPlayerEntity {
  return {
    matchId: 1,
    userId: 1,
    team: 'A',
    slot: 1,
    position: null,
    ...overrides,
  } as unknown as MatchPlayerEntity;
}

describe('MatchService', () => {
  let service: MatchService;
  let repo: ReturnType<typeof mockMatchRepository>;
  let queue: ReturnType<typeof mockQueue>;

  beforeEach(async () => {
    repo = mockMatchRepository();
    queue = mockQueue();

    const module = await Test.createTestingModule({
      providers: [
        MatchService,
        { provide: MatchRepository, useValue: repo },
        { provide: getQueueToken(QUEUE_MATCHES), useValue: queue },
      ],
    }).compile();

    service = module.get(MatchService);
  });

  describe('create', () => {
    it('creates a match with default 2v2 type', async () => {
      const match = makeMatch();
      repo.create.mockResolvedValue(match);

      const result = await service.create(10, {});
      expect(repo.create).toHaveBeenCalledWith({ createdBy: 10, matchType: '2v2', status: 'draft' });
      expect(result.players).toEqual([]);
    });

    it('creates a match with explicit matchType', async () => {
      const match = makeMatch({ matchType: '1v1' });
      repo.create.mockResolvedValue(match);

      await service.create(10, { matchType: '1v1' });
      expect(repo.create).toHaveBeenCalledWith({ createdBy: 10, matchType: '1v1', status: 'draft' });
    });
  });

  describe('findById', () => {
    it('returns the match when found', async () => {
      const match = makeMatch();
      repo.findById.mockResolvedValue(match);

      const result = await service.findById(1);
      expect(result).toBe(match);
    });

    it('throws NotFoundException when match not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findById(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates scores when called by creator', async () => {
      const match = makeMatch({ status: 'playing' });
      repo.findById.mockResolvedValue(match);
      repo.save.mockResolvedValue({ ...match, scoreA: 5, scoreB: 3 });
      repo.findPlayers.mockResolvedValue([]);

      const result = await service.update(1, 10, { scoreA: 5, scoreB: 3 });
      expect(result.scoreA).toBe(5);
      expect(result.scoreB).toBe(3);
    });

    it('throws ForbiddenException when non-creator tries to update', async () => {
      const match = makeMatch({ createdBy: 10 });
      repo.findById.mockResolvedValue(match);

      await expect(service.update(1, 99, { scoreA: 5 })).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException (MATCH_LOCKED) when status is awaiting_confirmation', async () => {
      const match = makeMatch({ status: 'awaiting_confirmation' });
      repo.findById.mockResolvedValue(match);

      await expect(service.update(1, 10, { scoreA: 5 })).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException (MATCH_LOCKED) when status is confirmed', async () => {
      const match = makeMatch({ status: 'confirmed' });
      repo.findById.mockResolvedValue(match);

      await expect(service.update(1, 10, { scoreA: 5 })).rejects.toThrow(ConflictException);
    });
  });

  describe('addPlayers', () => {
    it('adds players and transitions draft→playing', async () => {
      const match = makeMatch({ status: 'draft' });
      const player = makePlayer({ userId: 1, team: 'A', slot: 1 });
      repo.findById.mockResolvedValue(match);
      repo.findPlayers.mockResolvedValueOnce([]).mockResolvedValue([player]);
      repo.savePlayers.mockResolvedValue([player]);
      repo.save.mockResolvedValue(match);

      const result = await service.addPlayers(1, 10, {
        players: [{ userId: 1, team: 'A', slot: 1 }],
      });
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'playing' }));
      expect(result.players).toHaveLength(1);
    });

    it('throws ForbiddenException when non-creator tries to add players', async () => {
      const match = makeMatch({ createdBy: 10 });
      repo.findById.mockResolvedValue(match);

      await expect(
        service.addPlayers(1, 99, { players: [{ userId: 1, team: 'A', slot: 1 }] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException (CAPACITY_EXCEEDED) when capacity is full', async () => {
      const match = makeMatch({ matchType: '1v1', status: 'playing' });
      repo.findById.mockResolvedValue(match);
      // 1v1 capacity = 2; already has 2
      const existingPlayers = [
        makePlayer({ userId: 1, team: 'A', slot: 1 }),
        makePlayer({ userId: 2, team: 'B', slot: 1 }),
      ];
      repo.findPlayers.mockResolvedValue(existingPlayers);

      await expect(
        service.addPlayers(1, 10, { players: [{ userId: 3, team: 'A', slot: 2 }] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException (SLOT_CONFLICT) when slot is taken', async () => {
      const match = makeMatch({ matchType: '2v2', status: 'playing' });
      repo.findById.mockResolvedValue(match);
      repo.findPlayers.mockResolvedValue([makePlayer({ team: 'A', slot: 1 })]);

      await expect(
        service.addPlayers(1, 10, { players: [{ userId: 99, team: 'A', slot: 1 }] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException (MATCH_LOCKED) when match is confirmed', async () => {
      const match = makeMatch({ status: 'confirmed' });
      repo.findById.mockResolvedValue(match);

      await expect(
        service.addPlayers(1, 10, { players: [{ userId: 1, team: 'A', slot: 1 }] }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('submitResult', () => {
    const fourPlayers = [
      makePlayer({ userId: 1, team: 'A', slot: 1 }),
      makePlayer({ userId: 2, team: 'A', slot: 2 }),
      makePlayer({ userId: 3, team: 'B', slot: 1 }),
      makePlayer({ userId: 4, team: 'B', slot: 2 }),
    ];

    it('transitions to awaiting_confirmation and publishes event', async () => {
      const match = makeMatch({ status: 'playing' });
      repo.findById.mockResolvedValue(match);
      repo.findPlayers.mockResolvedValue(fourPlayers);
      repo.save.mockResolvedValue({ ...match, status: 'awaiting_confirmation', scoreA: 5, scoreB: 3 });

      const result = await service.submitResult(1, 10, { scoreA: 5, scoreB: 3 });
      expect(result.status).toBe('awaiting_confirmation');
      expect(queue.add).toHaveBeenCalledWith(
        'match.result_submitted',
        expect.objectContaining({
          eventType: 'match.result_submitted',
          version: 1,
          payload: expect.objectContaining({ matchId: 1, scoreA: 5, scoreB: 3 }),
        }),
        expect.anything(),
      );
    });

    it('throws ForbiddenException when non-creator submits result', async () => {
      const match = makeMatch({ createdBy: 10 });
      repo.findById.mockResolvedValue(match);

      await expect(service.submitResult(1, 99, { scoreA: 5, scoreB: 3 })).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException (INSUFFICIENT_PLAYERS) when player count is short', async () => {
      const match = makeMatch({ matchType: '2v2', status: 'playing' });
      repo.findById.mockResolvedValue(match);
      repo.findPlayers.mockResolvedValue([makePlayer(), makePlayer({ userId: 2 })]);

      await expect(service.submitResult(1, 10, { scoreA: 5, scoreB: 3 })).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException (MATCH_LOCKED) when already awaiting_confirmation', async () => {
      const match = makeMatch({ status: 'awaiting_confirmation' });
      repo.findById.mockResolvedValue(match);

      await expect(service.submitResult(1, 10, { scoreA: 5, scoreB: 3 })).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('deletes match when admin', async () => {
      const match = makeMatch();
      repo.findById.mockResolvedValue(match);
      repo.delete.mockResolvedValue(undefined);

      await service.delete(1, 10, true);
      expect(repo.delete).toHaveBeenCalledWith(1);
    });

    it('throws ForbiddenException when not admin', async () => {
      await expect(service.delete(1, 10, false)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when match not found (admin)', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.delete(99, 10, true)).rejects.toThrow(NotFoundException);
    });
  });
});
