import { MatchRepository } from './match.repository';
import { MatchStatus, MatchType, MatchEntity } from '../entities/match.entity';
import { MatchPlayerEntity } from '../entities/match-player.entity';
import { MatchConfirmationEntity } from '../entities/match-confirmation.entity';
import { AuditLogEntity } from '../entities/audit-log.entity';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function makeMatch(overrides: Partial<MatchEntity> = {}): MatchEntity {
  return {
    id: 1,
    createdBy: 10,
    matchType: '2v2' as MatchType,
    status: 'draft' as MatchStatus,
    scoreA: null,
    scoreB: null,
    createdAt: new Date('2024-01-15T10:00:00.000Z'),
    updatedAt: new Date('2024-01-15T10:00:00.000Z'),
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

function makeConfirmation(overrides: Partial<MatchConfirmationEntity> = {}): MatchConfirmationEntity {
  return {
    matchId: 1,
    userId: 1,
    confirmedAt: new Date(),
    ...overrides,
  } as unknown as MatchConfirmationEntity;
}

function makeAuditLog(overrides: Partial<AuditLogEntity> = {}): AuditLogEntity {
  return {
    id: 1,
    actorId: 2,
    action: 'result_override',
    entityType: 'match',
    entityId: 1,
    beforeData: {},
    afterData: {},
    reason: null,
    createdAt: new Date(),
    ...overrides,
  } as unknown as AuditLogEntity;
}

// ──────────────────────────────────────────────────────────────────────────────
// QueryBuilder mock factory — returns a chainable spy object
// ──────────────────────────────────────────────────────────────────────────────

function makeQb(rows: MatchEntity[]) {
  const qb: any = {};
  qb.orderBy = jest.fn().mockReturnValue(qb);
  qb.addOrderBy = jest.fn().mockReturnValue(qb);
  qb.take = jest.fn().mockReturnValue(qb);
  qb.andWhere = jest.fn().mockReturnValue(qb);
  qb.getMany = jest.fn().mockResolvedValue(rows);
  return qb;
}

// ──────────────────────────────────────────────────────────────────────────────
// Repository mock factories
// ──────────────────────────────────────────────────────────────────────────────

function makeMatchRepo(qb?: any) {
  return {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(qb ?? makeQb([])),
  };
}

function makePlayerRepo() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
}

function makeConfirmationRepo() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

function makeAuditLogRepo() {
  return {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
}

function makeDataSource() {
  return {} as any;
}

// ──────────────────────────────────────────────────────────────────────────────
// Build MatchRepository with injected mocks (bypass NestJS DI)
// ──────────────────────────────────────────────────────────────────────────────

function buildRepository(
  matchRepo?: ReturnType<typeof makeMatchRepo>,
  playerRepo?: ReturnType<typeof makePlayerRepo>,
  confirmationRepo?: ReturnType<typeof makeConfirmationRepo>,
  auditLogRepo?: ReturnType<typeof makeAuditLogRepo>,
  dataSource?: any,
) {
  const mr = matchRepo ?? makeMatchRepo();
  const pr = playerRepo ?? makePlayerRepo();
  const cr = confirmationRepo ?? makeConfirmationRepo();
  const ar = auditLogRepo ?? makeAuditLogRepo();
  const ds = dataSource ?? makeDataSource();
  // MatchRepository constructor receives the 5 injected deps in order
  return new MatchRepository(mr as any, pr as any, cr as any, ar as any, ds);
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe('MatchRepository', () => {
  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('delegates to matchRepo.findOne with id and players relation', async () => {
      const match = makeMatch();
      const matchRepo = makeMatchRepo();
      matchRepo.findOne.mockResolvedValue(match);

      const repo = buildRepository(matchRepo as any);
      const result = await repo.findById(1);

      expect(matchRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['players'],
      });
      expect(result).toBe(match);
    });

    it('returns null when match does not exist', async () => {
      const matchRepo = makeMatchRepo();
      matchRepo.findOne.mockResolvedValue(null);

      const repo = buildRepository(matchRepo as any);
      const result = await repo.findById(999);
      expect(result).toBeNull();
    });
  });

  // ── save ──────────────────────────────────────────────────────────────────

  describe('save', () => {
    it('saves and returns the match entity', async () => {
      const match = makeMatch({ scoreA: 3 });
      const matchRepo = makeMatchRepo();
      matchRepo.save.mockResolvedValue(match);

      const repo = buildRepository(matchRepo as any);
      const result = await repo.save(match);

      expect(matchRepo.save).toHaveBeenCalledWith(match);
      expect(result).toBe(match);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates and persists a new match entity', async () => {
      const data: Partial<MatchEntity> = { createdBy: 10, matchType: '2v2', status: 'draft' };
      const match = makeMatch(data);
      const matchRepo = makeMatchRepo();
      matchRepo.create.mockReturnValue(match);
      matchRepo.save.mockResolvedValue(match);

      const repo = buildRepository(matchRepo as any);
      const result = await repo.create(data);

      expect(matchRepo.create).toHaveBeenCalledWith(data);
      expect(matchRepo.save).toHaveBeenCalledWith(match);
      expect(result).toBe(match);
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('calls matchRepo.delete with the id', async () => {
      const matchRepo = makeMatchRepo();
      matchRepo.delete.mockResolvedValue({ affected: 1 });

      const repo = buildRepository(matchRepo as any);
      await repo.delete(42);

      expect(matchRepo.delete).toHaveBeenCalledWith(42);
    });
  });

  // ── findPaginated ─────────────────────────────────────────────────────────

  describe('findPaginated', () => {
    it('returns empty data with no results', async () => {
      const qb = makeQb([]);
      const matchRepo = makeMatchRepo(qb);
      const repo = buildRepository(matchRepo as any);

      const result = await repo.findPaginated({ limit: 10 });

      expect(result.data).toEqual([]);
      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.nextCursor).toBeNull();
      expect(result.pagination.limit).toBe(10);
    });

    it('returns results without nextCursor when fewer rows than limit', async () => {
      const matches = [makeMatch({ id: 1 }), makeMatch({ id: 2 })];
      const qb = makeQb(matches);
      const matchRepo = makeMatchRepo(qb);
      const repo = buildRepository(matchRepo as any);

      const result = await repo.findPaginated({ limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.nextCursor).toBeNull();
    });

    it('returns hasMore=true and nextCursor when rows = limit+1', async () => {
      // limit=2, so we request take=3; return 3 rows → hasMore=true
      const matches = [
        makeMatch({ id: 3, createdAt: new Date('2024-01-15T12:00:00.000Z') }),
        makeMatch({ id: 2, createdAt: new Date('2024-01-15T11:00:00.000Z') }),
        makeMatch({ id: 1, createdAt: new Date('2024-01-15T10:00:00.000Z') }),
      ];
      const qb = makeQb(matches);
      const matchRepo = makeMatchRepo(qb);
      const repo = buildRepository(matchRepo as any);

      const result = await repo.findPaginated({ limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.nextCursor).not.toBeNull();

      // Cursor must decode to last row in the returned page (id=2)
      const decoded = JSON.parse(
        Buffer.from(result.pagination.nextCursor!, 'base64').toString('utf-8'),
      );
      expect(decoded.id).toBe(2);
    });

    it('applies status filter via andWhere', async () => {
      const qb = makeQb([]);
      const matchRepo = makeMatchRepo(qb);
      const repo = buildRepository(matchRepo as any);

      await repo.findPaginated({ limit: 10, status: 'confirmed' });

      expect(qb.andWhere).toHaveBeenCalledWith('m.status = :status', { status: 'confirmed' });
    });

    it('applies matchType filter via andWhere', async () => {
      const qb = makeQb([]);
      const matchRepo = makeMatchRepo(qb);
      const repo = buildRepository(matchRepo as any);

      await repo.findPaginated({ limit: 10, matchType: '1v1' });

      expect(qb.andWhere).toHaveBeenCalledWith('m.match_type = :matchType', { matchType: '1v1' });
    });

    it('applies createdBy filter via andWhere', async () => {
      const qb = makeQb([]);
      const matchRepo = makeMatchRepo(qb);
      const repo = buildRepository(matchRepo as any);

      await repo.findPaginated({ limit: 10, createdBy: 7 });

      expect(qb.andWhere).toHaveBeenCalledWith('m.created_by = :createdBy', { createdBy: 7 });
    });

    it('applies all three filters simultaneously', async () => {
      const qb = makeQb([]);
      const matchRepo = makeMatchRepo(qb);
      const repo = buildRepository(matchRepo as any);

      await repo.findPaginated({
        limit: 5,
        status: 'playing',
        matchType: '2v2',
        createdBy: 10,
      });

      expect(qb.andWhere).toHaveBeenCalledWith('m.status = :status', { status: 'playing' });
      expect(qb.andWhere).toHaveBeenCalledWith('m.match_type = :matchType', { matchType: '2v2' });
      expect(qb.andWhere).toHaveBeenCalledWith('m.created_by = :createdBy', { createdBy: 10 });
    });

    it('decodes cursor and applies cursor WHERE clause', async () => {
      const qb = makeQb([]);
      const matchRepo = makeMatchRepo(qb);
      const repo = buildRepository(matchRepo as any);

      const cursorData = { createdAt: '2024-01-15T10:00:00.000Z', id: 5 };
      const cursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');

      await repo.findPaginated({ limit: 10, cursor });

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(m.created_at < :cursorAt OR (m.created_at = :cursorAt AND m.id < :cursorId))',
        { cursorAt: cursorData.createdAt, cursorId: cursorData.id },
      );
    });

    it('does not call andWhere when no optional filters provided', async () => {
      const qb = makeQb([]);
      const matchRepo = makeMatchRepo(qb);
      const repo = buildRepository(matchRepo as any);

      await repo.findPaginated({ limit: 20 });

      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('sets take to limit+1 via qb.take', async () => {
      const qb = makeQb([]);
      const matchRepo = makeMatchRepo(qb);
      const repo = buildRepository(matchRepo as any);

      await repo.findPaginated({ limit: 15 });

      expect(qb.take).toHaveBeenCalledWith(16);
    });
  });

  // ── findPlayers ───────────────────────────────────────────────────────────

  describe('findPlayers', () => {
    it('returns players for a match', async () => {
      const players = [makePlayer({ userId: 1 }), makePlayer({ userId: 2 })];
      const playerRepo = makePlayerRepo();
      playerRepo.find.mockResolvedValue(players);

      const repo = buildRepository(undefined, playerRepo as any);
      const result = await repo.findPlayers(1);

      expect(playerRepo.find).toHaveBeenCalledWith({ where: { matchId: 1 } });
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no players', async () => {
      const playerRepo = makePlayerRepo();
      playerRepo.find.mockResolvedValue([]);

      const repo = buildRepository(undefined, playerRepo as any);
      const result = await repo.findPlayers(99);
      expect(result).toEqual([]);
    });
  });

  // ── findPlayer ────────────────────────────────────────────────────────────

  describe('findPlayer', () => {
    it('returns a specific player', async () => {
      const player = makePlayer({ userId: 3 });
      const playerRepo = makePlayerRepo();
      playerRepo.findOne.mockResolvedValue(player);

      const repo = buildRepository(undefined, playerRepo as any);
      const result = await repo.findPlayer(1, 3);

      expect(playerRepo.findOne).toHaveBeenCalledWith({ where: { matchId: 1, userId: 3 } });
      expect(result).toBe(player);
    });

    it('returns null when player not found', async () => {
      const playerRepo = makePlayerRepo();
      playerRepo.findOne.mockResolvedValue(null);

      const repo = buildRepository(undefined, playerRepo as any);
      const result = await repo.findPlayer(1, 999);
      expect(result).toBeNull();
    });
  });

  // ── savePlayers ───────────────────────────────────────────────────────────

  describe('savePlayers', () => {
    it('creates and saves player entities', async () => {
      const playerData = [
        { matchId: 1, userId: 1, team: 'A' as const, slot: 1, position: null },
        { matchId: 1, userId: 2, team: 'B' as const, slot: 1, position: null },
      ];
      const playerEntities = playerData.map((p) => ({ ...p }));
      const savedPlayers = playerData.map((p) => ({ ...p }));

      const playerRepo = makePlayerRepo();
      playerRepo.create.mockImplementation((p: any) => ({ ...p }));
      playerRepo.save.mockResolvedValue(savedPlayers);

      const repo = buildRepository(undefined, playerRepo as any);
      const result = await repo.savePlayers(playerData);

      expect(playerRepo.create).toHaveBeenCalledTimes(2);
      expect(playerRepo.save).toHaveBeenCalled();
      expect(result).toBe(savedPlayers);
    });
  });

  // ── findConfirmations ─────────────────────────────────────────────────────

  describe('findConfirmations', () => {
    it('returns all confirmations for a match', async () => {
      const confs = [makeConfirmation({ userId: 1 }), makeConfirmation({ userId: 2 })];
      const confirmationRepo = makeConfirmationRepo();
      confirmationRepo.find.mockResolvedValue(confs);

      const repo = buildRepository(undefined, undefined, confirmationRepo as any);
      const result = await repo.findConfirmations(1);

      expect(confirmationRepo.find).toHaveBeenCalledWith({ where: { matchId: 1 } });
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no confirmations exist', async () => {
      const confirmationRepo = makeConfirmationRepo();
      confirmationRepo.find.mockResolvedValue([]);

      const repo = buildRepository(undefined, undefined, confirmationRepo as any);
      const result = await repo.findConfirmations(99);
      expect(result).toEqual([]);
    });
  });

  // ── findConfirmation ──────────────────────────────────────────────────────

  describe('findConfirmation', () => {
    it('returns a specific confirmation', async () => {
      const conf = makeConfirmation({ userId: 5 });
      const confirmationRepo = makeConfirmationRepo();
      confirmationRepo.findOne.mockResolvedValue(conf);

      const repo = buildRepository(undefined, undefined, confirmationRepo as any);
      const result = await repo.findConfirmation(1, 5);

      expect(confirmationRepo.findOne).toHaveBeenCalledWith({ where: { matchId: 1, userId: 5 } });
      expect(result).toBe(conf);
    });

    it('returns null when confirmation not found', async () => {
      const confirmationRepo = makeConfirmationRepo();
      confirmationRepo.findOne.mockResolvedValue(null);

      const repo = buildRepository(undefined, undefined, confirmationRepo as any);
      const result = await repo.findConfirmation(1, 999);
      expect(result).toBeNull();
    });
  });

  // ── saveConfirmation ──────────────────────────────────────────────────────

  describe('saveConfirmation', () => {
    it('creates and saves a confirmation entity', async () => {
      const conf = makeConfirmation({ matchId: 1, userId: 3 });
      const confirmationRepo = makeConfirmationRepo();
      confirmationRepo.create.mockReturnValue(conf);
      confirmationRepo.save.mockResolvedValue(conf);

      const repo = buildRepository(undefined, undefined, confirmationRepo as any);
      const result = await repo.saveConfirmation(1, 3);

      expect(confirmationRepo.create).toHaveBeenCalledWith({ matchId: 1, userId: 3 });
      expect(confirmationRepo.save).toHaveBeenCalledWith(conf);
      expect(result).toBe(conf);
    });
  });

  // ── deleteAllConfirmations ────────────────────────────────────────────────

  describe('deleteAllConfirmations', () => {
    it('calls delete with matchId predicate', async () => {
      const confirmationRepo = makeConfirmationRepo();
      confirmationRepo.delete.mockResolvedValue({ affected: 3 });

      const repo = buildRepository(undefined, undefined, confirmationRepo as any);
      await repo.deleteAllConfirmations(42);

      expect(confirmationRepo.delete).toHaveBeenCalledWith({ matchId: 42 });
    });
  });

  // ── saveAuditLog ──────────────────────────────────────────────────────────

  describe('saveAuditLog', () => {
    it('creates and saves an audit log entry', async () => {
      const log = makeAuditLog();
      const auditLogRepo = makeAuditLogRepo();
      auditLogRepo.create.mockReturnValue(log);
      auditLogRepo.save.mockResolvedValue(log);

      const repo = buildRepository(undefined, undefined, undefined, auditLogRepo as any);
      const result = await repo.saveAuditLog({ actorId: 2, action: 'result_override', entityType: 'match', entityId: 1, beforeData: {}, afterData: {} });

      expect(auditLogRepo.create).toHaveBeenCalled();
      expect(auditLogRepo.save).toHaveBeenCalledWith(log);
      expect(result).toBe(log);
    });
  });

  // ── findAuditLogs ─────────────────────────────────────────────────────────

  describe('findAuditLogs', () => {
    it('returns audit logs ordered by createdAt ASC', async () => {
      const logs = [makeAuditLog({ id: 1 }), makeAuditLog({ id: 2 })];
      const auditLogRepo = makeAuditLogRepo();
      auditLogRepo.find.mockResolvedValue(logs);

      const repo = buildRepository(undefined, undefined, undefined, auditLogRepo as any);
      const result = await repo.findAuditLogs('match', 42);

      expect(auditLogRepo.find).toHaveBeenCalledWith({
        where: { entityType: 'match', entityId: 42 },
        order: { createdAt: 'ASC' },
      });
      expect(result).toBe(logs);
    });

    it('returns empty array when no audit logs exist', async () => {
      const auditLogRepo = makeAuditLogRepo();
      auditLogRepo.find.mockResolvedValue([]);

      const repo = buildRepository(undefined, undefined, undefined, auditLogRepo as any);
      const result = await repo.findAuditLogs('match', 99);
      expect(result).toEqual([]);
    });
  });

  // ── getDataSource ─────────────────────────────────────────────────────────

  describe('getDataSource', () => {
    it('returns the injected DataSource', () => {
      const ds = { query: jest.fn() } as any;
      const repo = buildRepository(undefined, undefined, undefined, undefined, ds);
      expect(repo.getDataSource()).toBe(ds);
    });
  });
});
