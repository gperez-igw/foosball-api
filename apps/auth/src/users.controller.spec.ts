import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UserService } from '@app/users/user.service';
import { UserEntity } from '@app/users/user.entity';
import type { JwtPayload } from '@app/auth/token.service';

// ── helpers ──────────────────────────────────────────────────────────────────

function mockUser(overrides: Partial<UserEntity> = {}): UserEntity {
  const u = new UserEntity();
  u.id = 1;
  u.azureOid = 'oid-001';
  u.email = 'mario@foosball.test';
  u.displayName = 'Mario Rossi';
  u.isAdmin = false;
  u.createdAt = new Date('2026-01-01T00:00:00Z');
  u.updatedAt = new Date('2026-01-01T00:00:00Z');
  return Object.assign(u, overrides);
}

function mockPayload(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return { sub: 1, email: 'mario@foosball.test', is_admin: false, azure_oid: 'oid-001', ...overrides };
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('UsersController', () => {
  let controller: UsersController;
  let userService: jest.Mocked<UserService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UserService,
          useValue: {
            findById: jest.fn(),
            updateDisplayName: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(require('@app/auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
    userService = module.get(UserService);
  });

  // ── GET /users/me ──────────────────────────────────────────────────────────

  describe('getProfile()', () => {
    it('returns user profile using sub from JWT payload', async () => {
      const entity = mockUser();
      userService.findById.mockResolvedValue(entity);
      const req = { user: mockPayload({ sub: 1 }) };

      const result = await controller.getProfile(req as any);

      expect(userService.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual({
        id: entity.id,
        email: entity.email,
        displayName: entity.displayName,
        isAdmin: entity.isAdmin,
        createdAt: entity.createdAt,
      });
    });

    it('returns isAdmin: true for admin users', async () => {
      const entity = mockUser({ isAdmin: true });
      userService.findById.mockResolvedValue(entity);
      const req = { user: mockPayload({ is_admin: true }) };

      const result = await controller.getProfile(req as any);

      expect(result.isAdmin).toBe(true);
    });

    it('does not expose updatedAt or azureOid', async () => {
      const entity = mockUser();
      userService.findById.mockResolvedValue(entity);
      const req = { user: mockPayload() };

      const result = await controller.getProfile(req as any);

      expect(result).not.toHaveProperty('updatedAt');
      expect(result).not.toHaveProperty('azureOid');
    });
  });

  // ── PATCH /users/me ────────────────────────────────────────────────────────

  describe('updateProfile()', () => {
    it('returns updated profile when displayName is provided', async () => {
      const entity = mockUser({ displayName: 'Mario R.' });
      userService.updateDisplayName.mockResolvedValue(entity);
      const req = { user: mockPayload({ sub: 1 }) };

      const result = await controller.updateProfile(req as any, { displayName: 'Mario R.' });

      expect(userService.updateDisplayName).toHaveBeenCalledWith(1, 'Mario R.');
      expect(result).toEqual({
        id: entity.id,
        email: entity.email,
        displayName: entity.displayName,
        isAdmin: entity.isAdmin,
        createdAt: entity.createdAt,
      });
    });

    it('throws BadRequestException when displayName is absent', async () => {
      const req = { user: mockPayload() };

      await expect(controller.updateProfile(req as any, {})).rejects.toThrow(BadRequestException);
      expect(userService.updateDisplayName).not.toHaveBeenCalled();
    });

    it('throws BadRequestException with VALIDATION_ERROR code when displayName missing', async () => {
      const req = { user: mockPayload() };

      try {
        await controller.updateProfile(req as any, {});
        fail('should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const resp = err.getResponse() as any;
        expect(resp.code).toBe('VALIDATION_ERROR');
      }
    });

    it('does not expose updatedAt in the response', async () => {
      const entity = mockUser({ displayName: 'Updated' });
      userService.updateDisplayName.mockResolvedValue(entity);
      const req = { user: mockPayload() };

      const result = await controller.updateProfile(req as any, { displayName: 'Updated' });

      expect(result).not.toHaveProperty('updatedAt');
    });

    it('uses sub from JWT payload (not from body) to identify the user', async () => {
      const entity = mockUser({ id: 42 });
      userService.updateDisplayName.mockResolvedValue(entity);
      const req = { user: mockPayload({ sub: 42 }) };

      await controller.updateProfile(req as any, { displayName: 'New Name' });

      expect(userService.updateDisplayName).toHaveBeenCalledWith(42, 'New Name');
    });
  });
});
