import { Test } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfirmationService } from './confirmation.service';
import { MatchRepository } from '../repositories/match.repository';
import { QUEUE_MATCHES, QUEUE_LEADERBOARD } from '@app/events';
import type { MatchEntity } from '../entities/match.entity';
import type { MatchPlayerEntity } from '../entities/match-player.entity';
import type { MatchConfirmationEntity } from '../entities/match-confirmation.entity';

const mockMatchRepository = () => ({
  findById: jest.fn(),
  save: jest.fn(),
  findPlayers: jest.fn(),
  findConfirmations: jest.fn(),
  findConfirmation: jest.fn(),
  saveConfirmation: jest.fn(),
  deleteAllConfirmations: jest.fn(),
  getDataSource: jest.fn(),
});

/**
 * Builds a mock QueryRunner whose manager re-delegates to the repo mocks
 * so tests can control per-call behavior via the existing repo mock setup.
 * confirmedInTx: set to true to simulate the match already transitioned
 *                to 'confirmed' by the time the lock is acquired.
 */
function makeConfirmQueryRunner(
  repo: ReturnType<typeof mockMatchRepository>,
  opts: { confirmedInTx?: boolean } = {},
) {
  const manager = {
    findOne: jest.fn().mockImplementation(async (_EntityClass: any, options: any) => {
      // Determine which entity is being queried from the where clause shape
      if (options?.where && 'id' in options.where) {
        // Match row lookup with lock
        const match = await repo.findById(options.where.id);
        if (opts.confirmedInTx && match) {
          return { ...match, status: 'confirmed' };
        }
        return match;
      }
      // MatchConfirmation lookup (matchId + userId)
      if (options?.where && 'userId' in options.where) {
        return repo.findConfirmation(options.where.matchId, options.where.userId);
      }
      return null;
    }),
    find: jest.fn().mockImplementation(async (_EntityClass: any, options: any) => {
      return repo.findConfirmations(options?.where?.matchId);
    }),
    create: jest.fn().mockImplementation((_EntityClass: any, data: any) => data),
    save: jest.fn().mockImplementation(async (entity: any) => entity),
  };
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager,
  };
}

const mockQueue = () => ({
  add: jest.fn().mockResolvedValue(undefined),
});

function makeMatch(overrides: Partial<MatchEntity> = {}): MatchEntity {
  return {
    id: 42,
    createdBy: 10,
    matchType: '2v2',
    status: 'awaiting_confirmation',
    scoreA: 5,
    scoreB: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    confirmedAt: null,
    lockedAt: null,
    players: [],
    confirmations: [],
    ...overrides,
  } as unknown as MatchEntity;
}

function makePlayer(userId: number, team: 'A' | 'B', slot: number): MatchPlayerEntity {
  return { matchId: 42, userId, team, slot, position: null } as unknown as MatchPlayerEntity;
}

function makeConfirmation(userId: number): MatchConfirmationEntity {
  return { matchId: 42, userId, confirmedAt: new Date() } as unknown as MatchConfirmationEntity;
}

describe('ConfirmationService', () => {
  let service: ConfirmationService;
  let repo: ReturnType<typeof mockMatchRepository>;
  let matchesQueue: ReturnType<typeof mockQueue>;
  let leaderboardQueue: ReturnType<typeof mockQueue>;

  const fourPlayers = [
    makePlayer(1, 'A', 1),
    makePlayer(2, 'A', 2),
    makePlayer(3, 'B', 1),
    makePlayer(4, 'B', 2),
  ];

  beforeEach(async () => {
    repo = mockMatchRepository();
    matchesQueue = mockQueue();
    leaderboardQueue = mockQueue();

    const module = await Test.createTestingModule({
      providers: [
        ConfirmationService,
        { provide: MatchRepository, useValue: repo },
        { provide: getQueueToken(QUEUE_MATCHES), useValue: matchesQueue },
        { provide: getQueueToken(QUEUE_LEADERBOARD), useValue: leaderboardQueue },
      ],
    }).compile();

    service = module.get(ConfirmationService);
  });

  describe('calculateQuorum', () => {
    it.each([
      [2, 2],  // 1v1
      [4, 3],  // 2v2
      [8, 5],  // 4v4
    ])('totalPlayers=%i → quorum=%i', (total, expected) => {
      expect(service.calculateQuorum(total)).toBe(expected);
    });
  });

  describe('getStatus', () => {
    it('returns confirmation status for awaiting_confirmation match', async () => {
      const match = makeMatch();
      repo.findById.mockResolvedValue(match);
      repo.findPlayers.mockResolvedValue(fourPlayers);
      repo.findConfirmations.mockResolvedValue([makeConfirmation(1), makeConfirmation(3)]);

      const result = await service.getStatus(42);
      expect(result.totalPlayers).toBe(4);
      expect(result.confirmedCount).toBe(2);
      expect(result.quorumRequired).toBe(3);
      expect(result.quorumReached).toBe(false);
    });

    it('throws NotFoundException for unknown match', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.getStatus(99)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException (MATCH_NOT_AWAITING_CONFIRMATION) when match not in right status', async () => {
      const match = makeMatch({ status: 'draft' });
      repo.findById.mockResolvedValue(match);
      await expect(service.getStatus(42)).rejects.toThrow(ConflictException);
    });
  });

  describe('confirm', () => {
    it('records vote inside a transaction and returns quorumReached=false (2 of 4)', async () => {
      const match = makeMatch();
      const qr = makeConfirmQueryRunner(repo);
      repo.findById.mockResolvedValue(match);
      repo.findPlayers.mockResolvedValue(fourPlayers);
      repo.findConfirmation.mockResolvedValue(null);
      repo.findConfirmations.mockResolvedValue([makeConfirmation(1), makeConfirmation(3)]);
      repo.getDataSource.mockReturnValue({ createQueryRunner: () => qr });

      const result = await service.confirm(42, 1);
      expect(result.confirmedCount).toBe(2);
      expect(result.quorumReached).toBe(false);
      expect(matchesQueue.add).not.toHaveBeenCalled();
      // Confirm the transaction was opened and committed
      expect(qr.startTransaction).toHaveBeenCalled();
      expect(qr.commitTransaction).toHaveBeenCalled();
    });

    it('is idempotent when user already confirmed (no duplicate save inside tx)', async () => {
      const match = makeMatch();
      const qr = makeConfirmQueryRunner(repo);
      repo.findById.mockResolvedValue(match);
      repo.findPlayers.mockResolvedValue(fourPlayers);
      repo.findConfirmation.mockResolvedValue(makeConfirmation(1)); // already confirmed
      repo.findConfirmations.mockResolvedValue([makeConfirmation(1)]);
      repo.getDataSource.mockReturnValue({ createQueryRunner: () => qr });

      const result = await service.confirm(42, 1);
      // manager.create + manager.save must NOT be called for the confirmation row
      expect(qr.manager.create).not.toHaveBeenCalled();
      expect(result.confirmedCount).toBe(1);
    });

    it('reaches quorum, transitions to confirmed inside tx, publishes events exactly once', async () => {
      const match = makeMatch();
      const qr = makeConfirmQueryRunner(repo);
      repo.findById.mockResolvedValue(match);
      repo.findPlayers.mockResolvedValue(fourPlayers);
      repo.findConfirmation.mockResolvedValue(null);
      repo.findConfirmations.mockResolvedValue([
        makeConfirmation(1),
        makeConfirmation(3),
        makeConfirmation(4),
      ]);
      repo.getDataSource.mockReturnValue({ createQueryRunner: () => qr });

      const result = await service.confirm(42, 4);
      expect(result.quorumReached).toBe(true);
      // Status update must be inside the transaction via manager.save
      expect(qr.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'confirmed' }),
      );
      // repo.save (default connection) must NOT be used for the status transition
      expect(repo.save).not.toHaveBeenCalled();
      expect(qr.commitTransaction).toHaveBeenCalledTimes(1);
      expect(matchesQueue.add).toHaveBeenCalledTimes(1);
      expect(matchesQueue.add).toHaveBeenCalledWith(
        'match.confirmed',
        expect.objectContaining({ eventType: 'match.confirmed', version: 1 }),
        expect.anything(),
      );
      expect(leaderboardQueue.add).toHaveBeenCalledTimes(1);
      expect(leaderboardQueue.add).toHaveBeenCalledWith(
        'leaderboard-invalidate',
        expect.objectContaining({ eventType: 'leaderboard-invalidate', version: 1 }),
        expect.anything(),
      );
    });

    it('is idempotent under concurrent lock: returns current state when match already confirmed in tx', async () => {
      const match = makeMatch();
      const qr = makeConfirmQueryRunner(repo, { confirmedInTx: true });
      repo.findById.mockResolvedValue(match); // pre-check returns awaiting_confirmation
      repo.findPlayers.mockResolvedValue(fourPlayers);
      repo.findConfirmations.mockResolvedValue([
        makeConfirmation(1),
        makeConfirmation(3),
        makeConfirmation(4),
      ]);
      repo.getDataSource.mockReturnValue({ createQueryRunner: () => qr });

      const result = await service.confirm(42, 1);
      // Should NOT publish events a second time
      expect(matchesQueue.add).not.toHaveBeenCalled();
      expect(leaderboardQueue.add).not.toHaveBeenCalled();
      // Should rollback and return current state without error
      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(result.quorumReached).toBe(true); // confirmedCount 3 >= quorum 3
    });

    it('throws ForbiddenException (NOT_A_PLAYER) when caller is not a player', async () => {
      const match = makeMatch();
      repo.findById.mockResolvedValue(match);
      repo.findPlayers.mockResolvedValue(fourPlayers);

      await expect(service.confirm(42, 99)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for unknown match', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.confirm(99, 1)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when match not in awaiting_confirmation', async () => {
      const match = makeMatch({ status: 'playing' });
      repo.findById.mockResolvedValue(match);
      await expect(service.confirm(42, 1)).rejects.toThrow(ConflictException);
    });
  });

  describe('cancel', () => {
    it('resets quorum to 0 and transitions to playing, publishes event', async () => {
      const match = makeMatch({ createdBy: 10 });
      repo.findById.mockResolvedValue(match);
      repo.deleteAllConfirmations.mockResolvedValue(undefined);
      repo.save.mockResolvedValue({ ...match, status: 'playing' });
      repo.findPlayers.mockResolvedValue(fourPlayers);

      const result = await service.cancel(42, 10);
      expect(result.confirmedCount).toBe(0);
      expect(result.quorumReached).toBe(false);
      expect(result.confirmations).toEqual([]);
      expect(repo.deleteAllConfirmations).toHaveBeenCalledWith(42);
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'playing' }));
      expect(matchesQueue.add).toHaveBeenCalledWith(
        'match.confirmation_cancelled',
        expect.objectContaining({ eventType: 'match.confirmation_cancelled', version: 1 }),
        expect.anything(),
      );
    });

    it('throws ForbiddenException when non-creator tries to cancel', async () => {
      const match = makeMatch({ createdBy: 10 });
      repo.findById.mockResolvedValue(match);

      await expect(service.cancel(42, 99)).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException (MATCH_ALREADY_CONFIRMED) when confirmed', async () => {
      const match = makeMatch({ status: 'confirmed' });
      repo.findById.mockResolvedValue(match);

      await expect(service.cancel(42, 10)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when match not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.cancel(99, 10)).rejects.toThrow(NotFoundException);
    });
  });
});
