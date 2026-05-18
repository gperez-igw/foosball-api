import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';
import type { JwtPayload } from './token.service';

// ── helpers ────────────────────────────────────────────────────────────────────

function makePayload(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: 1,
    email: 'mario@foosball.test',
    is_admin: false,
    azure_oid: 'oid-001',
    ...overrides,
  };
}

/**
 * Build a minimal ExecutionContext where request.user is pre-set.
 */
function makeContext(user: JwtPayload | undefined): ExecutionContext {
  return {
    getHandler: jest.fn().mockReturnValue({}),
    getClass: jest.fn().mockReturnValue({}),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({ user }),
    }),
  } as unknown as ExecutionContext;
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: { getAllAndOverride: jest.fn() },
        },
      ],
    }).compile();

    guard = module.get(RolesGuard);
    reflector = module.get(Reflector);
  });

  // ── no @Roles decorator ─────────────────────────────────────────────────────

  describe('no required roles', () => {
    it('returns true when requiredRoles is undefined', () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const ctx = makeContext(undefined);

      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('returns true when requiredRoles is an empty array', () => {
      reflector.getAllAndOverride.mockReturnValue([]);
      const ctx = makeContext(undefined);

      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('returns true for any user (including undefined) when no roles required', () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const ctx = makeContext(makePayload());

      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  // ── admin role required — no user on request ────────────────────────────────

  describe('admin required — user missing from request', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(['admin']);
    });

    it('throws ForbiddenException when request.user is undefined', () => {
      const ctx = makeContext(undefined);

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });

  // ── admin role required — non-admin user ────────────────────────────────────

  describe('admin required — non-admin user', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(['admin']);
    });

    it('throws ForbiddenException when user.is_admin is false', () => {
      const ctx = makeContext(makePayload({ is_admin: false }));

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException error with FORBIDDEN_ADMIN_REQUIRED code', () => {
      const ctx = makeContext(makePayload({ is_admin: false }));

      try {
        guard.canActivate(ctx);
        fail('Expected ForbiddenException');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const response = (err as ForbiddenException).getResponse() as Record<string, unknown>;
        expect(response['code']).toBe('FORBIDDEN_ADMIN_REQUIRED');
      }
    });
  });

  // ── admin role required — admin user ────────────────────────────────────────

  describe('admin required — admin user', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(['admin']);
    });

    it('returns true when user.is_admin is true', () => {
      const ctx = makeContext(makePayload({ is_admin: true }));

      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('returns true for admin with additional fields', () => {
      const ctx = makeContext(
        makePayload({ is_admin: true, email: 'admin@foosball.test', sub: 42 }),
      );

      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  // ── reflector integration ───────────────────────────────────────────────────

  describe('reflector usage', () => {
    it('queries both handler and class for ROLES_KEY', () => {
      const handler = jest.fn();
      const cls = jest.fn();

      const ctx = {
        getHandler: jest.fn().mockReturnValue(handler),
        getClass: jest.fn().mockReturnValue(cls),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ user: makePayload({ is_admin: true }) }),
        }),
      } as unknown as ExecutionContext;

      reflector.getAllAndOverride.mockReturnValue(['admin']);

      guard.canActivate(ctx);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [handler, cls]);
    });
  });
});
