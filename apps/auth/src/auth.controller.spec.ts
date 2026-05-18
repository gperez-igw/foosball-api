import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from '@app/auth/auth.service';
import { UserService } from '@app/users/user.service';
import { UserEntity } from '@app/users/user.entity';
import type { JwtPayload } from '@app/auth/token.service';
import type { FastifyReply } from 'fastify';

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

function makeFastifyReply(): jest.Mocked<Pick<FastifyReply, 'redirect' | 'status' | 'send'>> & { status: jest.Mock } {
  const reply: any = {
    redirect: jest.fn(),
    send: jest.fn(),
    status: jest.fn(),
  };
  // status(n).send(...) chaining
  reply.status.mockReturnValue(reply);
  return reply;
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let userService: jest.Mocked<UserService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            getLoginUrl: jest.fn(),
            refresh: jest.fn(),
            logout: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    })
      // Override the JwtAuthGuard so it does not run during unit tests
      .overrideGuard(require('@app/auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
    userService = module.get(UserService);
  });

  // ── GET /auth/login ────────────────────────────────────────────────────────

  describe('login()', () => {
    it('redirects to the Azure login URL returned by authService', async () => {
      authService.getLoginUrl.mockResolvedValue('https://login.microsoftonline.com/authorize?foo=bar');
      const reply = makeFastifyReply();

      await controller.login(reply as any);

      expect(authService.getLoginUrl).toHaveBeenCalledTimes(1);
      expect(reply.redirect).toHaveBeenCalledWith('https://login.microsoftonline.com/authorize?foo=bar', 302);
    });
  });

  // ── POST /auth/refresh ─────────────────────────────────────────────────────

  describe('refresh()', () => {
    it('returns new token pair when refreshToken is valid', async () => {
      const tokenPair = { accessToken: 'new-jwt', refreshToken: 'new-rt', expiresIn: 900 };
      authService.refresh.mockResolvedValue(tokenPair);
      const validToken = 'a'.repeat(32);

      const result = await controller.refresh({ refreshToken: validToken });

      expect(authService.refresh).toHaveBeenCalledWith(validToken);
      expect(result).toEqual(tokenPair);
    });

    it('throws BadRequestException when refreshToken is absent', async () => {
      await expect(controller.refresh({})).rejects.toThrow(BadRequestException);
      expect(authService.refresh).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when refreshToken is too short (< 32 chars)', async () => {
      await expect(controller.refresh({ refreshToken: 'short' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException with VALIDATION_ERROR code when token is too short', async () => {
      try {
        await controller.refresh({ refreshToken: 'tooshort' });
        fail('should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const resp = err.getResponse() as any;
        expect(resp.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  // ── POST /auth/logout ──────────────────────────────────────────────────────

  describe('logout()', () => {
    it('delegates to authService.logout with the provided refreshToken', async () => {
      authService.logout.mockResolvedValue(undefined);
      const req = { user: mockPayload() };

      await controller.logout(req as any, { refreshToken: 'rt-token' });

      expect(authService.logout).toHaveBeenCalledWith('rt-token');
    });

    it('throws BadRequestException when refreshToken is absent', async () => {
      const req = { user: mockPayload() };

      await expect(controller.logout(req as any, {})).rejects.toThrow(BadRequestException);
      expect(authService.logout).not.toHaveBeenCalled();
    });

    it('throws BadRequestException with VALIDATION_ERROR code', async () => {
      const req = { user: mockPayload() };

      try {
        await controller.logout(req as any, {});
        fail('should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const resp = err.getResponse() as any;
        expect(resp.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  // ── GET /auth/me ───────────────────────────────────────────────────────────

  describe('me()', () => {
    it('returns user profile from userService.findById using sub from JWT payload', async () => {
      const entity = mockUser();
      userService.findById.mockResolvedValue(entity);
      const req = { user: mockPayload({ sub: 1 }) };

      const result = await controller.me(req as any);

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

      const result = await controller.me(req as any);

      expect(result.isAdmin).toBe(true);
    });

    it('does not expose updatedAt or azureOid in the response', async () => {
      const entity = mockUser();
      userService.findById.mockResolvedValue(entity);
      const req = { user: mockPayload() };

      const result = await controller.me(req as any);

      expect(result).not.toHaveProperty('updatedAt');
      expect(result).not.toHaveProperty('azureOid');
    });
  });
});
