import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { RefreshTokenService } from './refresh-token.service';
import { RefreshTokenEntity } from './refresh-token.entity';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
});

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        {
          provide: getRepositoryToken(RefreshTokenEntity),
          useValue: mockRepo(),
        },
      ],
    }).compile();

    service = module.get<RefreshTokenService>(RefreshTokenService);
    repo = module.get(getRepositoryToken(RefreshTokenEntity));
  });

  describe('issue', () => {
    it('should create a refresh token and return the raw token', async () => {
      const entity = new RefreshTokenEntity();
      entity.id = 1;
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue({ ...entity, id: 1 });

      const rawToken = await service.issue(1, 24 * 60 * 60 * 1000);

      expect(typeof rawToken).toBe('string');
      expect(rawToken.length).toBeGreaterThan(32);
      expect(repo.save).toHaveBeenCalled();
    });

    it('should store SHA-256 hash, not raw token', async () => {
      let capturedHash = '';
      const entity = new RefreshTokenEntity();
      repo.create.mockImplementation((data) => {
        capturedHash = data.tokenHash;
        return { ...entity, ...data };
      });
      repo.save.mockResolvedValue({ ...entity, id: 1 });

      const rawToken = await service.issue(1, 24 * 60 * 60 * 1000);

      const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      expect(capturedHash).toBe(expectedHash);
      expect(capturedHash).not.toBe(rawToken);
    });
  });

  describe('validate', () => {
    it('should return token entity for valid token', async () => {
      const rawToken = 'valid-raw-token-32chars-padding-extra';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const entity = new RefreshTokenEntity();
      entity.tokenHash = tokenHash;
      entity.usedAt = null;
      entity.expiresAt = new Date(Date.now() + 3600000);

      repo.findOne.mockResolvedValue(entity);

      const result = await service.validate(rawToken);
      expect(result).toBe(entity);
    });

    it('should throw UnauthorizedException for unknown token', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.validate('unknown-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for already-used token', async () => {
      const entity = new RefreshTokenEntity();
      entity.usedAt = new Date('2026-01-01');
      entity.expiresAt = new Date(Date.now() + 3600000);
      repo.findOne.mockResolvedValue(entity);

      await expect(service.validate('some-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for expired token', async () => {
      const entity = new RefreshTokenEntity();
      entity.usedAt = null;
      entity.expiresAt = new Date(Date.now() - 1000);
      repo.findOne.mockResolvedValue(entity);

      await expect(service.validate('some-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('rotate', () => {
    it('should create new token, mark old as used with replaced_by', async () => {
      const oldToken = new RefreshTokenEntity();
      oldToken.id = 1;
      oldToken.userId = 42;

      const newEntity = new RefreshTokenEntity();
      newEntity.id = 2;
      repo.create.mockReturnValue(newEntity);
      repo.save.mockResolvedValue({ ...newEntity, id: 2 });

      const rawToken = await service.rotate(oldToken, 42, 24 * 60 * 60 * 1000);

      expect(typeof rawToken).toBe('string');
      expect(repo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ usedAt: expect.any(Date), replacedBy: 2 }),
      );
    });
  });

  describe('invalidate', () => {
    it('should mark token as used', async () => {
      repo.update.mockResolvedValue({ affected: 1 });
      await service.invalidate('some-raw-token');
      expect(repo.update).toHaveBeenCalled();
    });
  });
});
