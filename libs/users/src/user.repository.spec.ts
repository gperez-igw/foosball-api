import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserRepository } from './user.repository';
import { UserEntity } from './user.entity';

// ── helpers ────────────────────────────────────────────────────────────────────

const makeUser = (overrides: Partial<UserEntity> = {}): UserEntity => {
  const u = new UserEntity();
  u.id = 1;
  u.azureOid = 'oid-001';
  u.email = 'mario@foosball.test';
  u.displayName = 'Mario Rossi';
  u.isAdmin = false;
  u.createdAt = new Date('2026-01-01T00:00:00Z');
  u.updatedAt = new Date('2026-01-01T00:00:00Z');
  return Object.assign(u, overrides);
};

const mockTypeOrmRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

// ── suite ─────────────────────────────────────────────────────────────────────

describe('UserRepository', () => {
  let repo: UserRepository;
  let typeOrmRepo: ReturnType<typeof mockTypeOrmRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRepository,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockTypeOrmRepo(),
        },
      ],
    }).compile();

    repo = module.get(UserRepository);
    typeOrmRepo = module.get(getRepositoryToken(UserEntity));
  });

  // ── findByAzureOid ──────────────────────────────────────────────────────────

  describe('findByAzureOid', () => {
    it('returns the user when found', async () => {
      const user = makeUser();
      typeOrmRepo.findOne.mockResolvedValue(user);

      const result = await repo.findByAzureOid('oid-001');

      expect(result).toBe(user);
      expect(typeOrmRepo.findOne).toHaveBeenCalledWith({ where: { azureOid: 'oid-001' } });
    });

    it('returns null when no user matches', async () => {
      typeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repo.findByAzureOid('non-existent-oid');

      expect(result).toBeNull();
    });

    it('passes the azureOid to the where clause', async () => {
      typeOrmRepo.findOne.mockResolvedValue(null);

      await repo.findByAzureOid('specific-oid-xyz');

      expect(typeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { azureOid: 'specific-oid-xyz' },
      });
    });
  });

  // ── findById ────────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns the user when found by id', async () => {
      const user = makeUser({ id: 42 });
      typeOrmRepo.findOne.mockResolvedValue(user);

      const result = await repo.findById(42);

      expect(result).toBe(user);
      expect(typeOrmRepo.findOne).toHaveBeenCalledWith({ where: { id: 42 } });
    });

    it('returns null when no user matches the id', async () => {
      typeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repo.findById(999);

      expect(result).toBeNull();
    });

    it('passes the id to the where clause', async () => {
      typeOrmRepo.findOne.mockResolvedValue(null);

      await repo.findById(7);

      expect(typeOrmRepo.findOne).toHaveBeenCalledWith({ where: { id: 7 } });
    });
  });

  // ── upsert — create path ────────────────────────────────────────────────────

  describe('upsert — create (new user)', () => {
    it('creates and saves a new user when azureOid not found', async () => {
      typeOrmRepo.findOne.mockResolvedValue(null); // findByAzureOid → null
      const newUser = makeUser();
      typeOrmRepo.create.mockReturnValue(newUser);
      typeOrmRepo.save.mockResolvedValue(newUser);

      const result = await repo.upsert({
        azureOid: 'oid-001',
        email: 'mario@foosball.test',
        displayName: 'Mario Rossi',
        isAdmin: false,
      });

      expect(typeOrmRepo.create).toHaveBeenCalledWith({
        azureOid: 'oid-001',
        email: 'mario@foosball.test',
        displayName: 'Mario Rossi',
        isAdmin: false,
      });
      expect(typeOrmRepo.save).toHaveBeenCalledWith(newUser);
      expect(result).toBe(newUser);
    });

    it('does NOT call create when user already exists', async () => {
      const existing = makeUser();
      typeOrmRepo.findOne.mockResolvedValue(existing);
      typeOrmRepo.save.mockResolvedValue(existing);

      await repo.upsert({
        azureOid: 'oid-001',
        email: 'updated@foosball.test',
        displayName: 'Mario Updated',
        isAdmin: true,
      });

      expect(typeOrmRepo.create).not.toHaveBeenCalled();
    });
  });

  // ── upsert — update path ────────────────────────────────────────────────────

  describe('upsert — update (existing user)', () => {
    it('updates email, displayName, isAdmin on existing user and saves', async () => {
      const existing = makeUser({
        email: 'old@foosball.test',
        displayName: 'Old Name',
        isAdmin: false,
      });
      typeOrmRepo.findOne.mockResolvedValue(existing);
      typeOrmRepo.save.mockImplementation(async (u) => u);

      const result = await repo.upsert({
        azureOid: 'oid-001',
        email: 'new@foosball.test',
        displayName: 'New Name',
        isAdmin: true,
      });

      expect(result.email).toBe('new@foosball.test');
      expect(result.displayName).toBe('New Name');
      expect(result.isAdmin).toBe(true);
      expect(typeOrmRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@foosball.test',
          displayName: 'New Name',
          isAdmin: true,
        }),
      );
    });

    it('returns the saved entity from typeOrmRepo.save', async () => {
      const existing = makeUser();
      const savedUser = makeUser({ displayName: 'Saved Name' });
      typeOrmRepo.findOne.mockResolvedValue(existing);
      typeOrmRepo.save.mockResolvedValue(savedUser);

      const result = await repo.upsert({
        azureOid: 'oid-001',
        email: existing.email,
        displayName: 'Saved Name',
        isAdmin: false,
      });

      expect(result).toBe(savedUser);
    });
  });

  // ── updateDisplayName ───────────────────────────────────────────────────────

  describe('updateDisplayName', () => {
    it('updates the displayName and returns the updated user', async () => {
      typeOrmRepo.update.mockResolvedValue({ affected: 1 } as any);
      const updatedUser = makeUser({ displayName: 'New Display Name' });
      typeOrmRepo.findOne.mockResolvedValue(updatedUser);

      const result = await repo.updateDisplayName(1, 'New Display Name');

      expect(typeOrmRepo.update).toHaveBeenCalledWith(1, { displayName: 'New Display Name' });
      expect(result).toBe(updatedUser);
    });

    it('calls typeOrmRepo.update with the correct id and displayName', async () => {
      typeOrmRepo.update.mockResolvedValue({ affected: 1 } as any);
      const user = makeUser({ id: 5, displayName: 'Updated' });
      typeOrmRepo.findOne.mockResolvedValue(user);

      await repo.updateDisplayName(5, 'Updated');

      expect(typeOrmRepo.update).toHaveBeenCalledWith(5, { displayName: 'Updated' });
    });

    it('throws an Error when user not found after update', async () => {
      typeOrmRepo.update.mockResolvedValue({ affected: 0 } as any);
      typeOrmRepo.findOne.mockResolvedValue(null); // user not found after update

      await expect(repo.updateDisplayName(999, 'Ghost')).rejects.toThrow(
        'User 999 not found after update',
      );
    });

    it('uses findById (findOne with { where: { id } }) to retrieve updated user', async () => {
      typeOrmRepo.update.mockResolvedValue({ affected: 1 } as any);
      const user = makeUser({ id: 3 });
      typeOrmRepo.findOne.mockResolvedValue(user);

      await repo.updateDisplayName(3, 'Some Name');

      expect(typeOrmRepo.findOne).toHaveBeenCalledWith({ where: { id: 3 } });
    });
  });
});
