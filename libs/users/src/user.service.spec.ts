import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { UserEntity } from './user.entity';

const mockUser = (): UserEntity => {
  const u = new UserEntity();
  u.id = 1;
  u.azureOid = 'azure-oid-123';
  u.email = 'mario.rossi@company.com';
  u.displayName = 'Mario Rossi';
  u.isAdmin = false;
  u.createdAt = new Date('2026-05-15T00:00:00Z');
  u.updatedAt = new Date('2026-05-15T00:00:00Z');
  return u;
};

describe('UserService', () => {
  let service: UserService;
  let repository: jest.Mocked<UserRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: UserRepository,
          useValue: {
            upsert: jest.fn(),
            findById: jest.fn(),
            updateDisplayName: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get(UserRepository);
  });

  describe('upsertFromAzure', () => {
    it('should create a new user on first login', async () => {
      const user = mockUser();
      repository.upsert.mockResolvedValue(user);

      const result = await service.upsertFromAzure({
        azureOid: 'azure-oid-123',
        email: 'mario.rossi@company.com',
        displayName: 'Mario Rossi',
        isAdmin: false,
      });

      expect(repository.upsert).toHaveBeenCalledWith({
        azureOid: 'azure-oid-123',
        email: 'mario.rossi@company.com',
        displayName: 'Mario Rossi',
        isAdmin: false,
      });
      expect(result).toBe(user);
    });

    it('should sync is_admin=true when user is in admin group', async () => {
      const user = mockUser();
      user.isAdmin = true;
      repository.upsert.mockResolvedValue(user);

      const result = await service.upsertFromAzure({
        azureOid: 'azure-oid-123',
        email: 'mario.rossi@company.com',
        displayName: 'Mario Rossi',
        isAdmin: true,
      });

      expect(result.isAdmin).toBe(true);
    });

    it('should update existing user profile on subsequent login', async () => {
      const user = mockUser();
      user.displayName = 'Mario Updated';
      repository.upsert.mockResolvedValue(user);

      const result = await service.upsertFromAzure({
        azureOid: 'azure-oid-123',
        email: 'mario.rossi@company.com',
        displayName: 'Mario Updated',
        isAdmin: false,
      });

      expect(result.displayName).toBe('Mario Updated');
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const user = mockUser();
      repository.findById.mockResolvedValue(user);

      const result = await service.findById(1);
      expect(result).toBe(user);
    });

    it('should throw NotFoundException when user not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateDisplayName', () => {
    it('should update display name', async () => {
      const user = mockUser();
      user.displayName = 'Mario R.';
      repository.updateDisplayName.mockResolvedValue(user);

      const result = await service.updateDisplayName(1, 'Mario R.');
      expect(result.displayName).toBe('Mario R.');
      expect(repository.updateDisplayName).toHaveBeenCalledWith(1, 'Mario R.');
    });

    it('should trim whitespace from display name', async () => {
      const user = mockUser();
      user.displayName = 'Mario R.';
      repository.updateDisplayName.mockResolvedValue(user);

      await service.updateDisplayName(1, '  Mario R.  ');
      expect(repository.updateDisplayName).toHaveBeenCalledWith(1, 'Mario R.');
    });

    it('should throw UnprocessableEntityException for empty display name', async () => {
      await expect(service.updateDisplayName(1, '')).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw UnprocessableEntityException for display name over 255 chars', async () => {
      const longName = 'a'.repeat(256);
      await expect(service.updateDisplayName(1, longName)).rejects.toThrow(UnprocessableEntityException);
    });
  });
});
