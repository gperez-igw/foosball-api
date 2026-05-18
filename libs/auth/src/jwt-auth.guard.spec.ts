import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from './public.decorator';
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
 * Build a minimal ExecutionContext mock.
 * @param headers   - HTTP request headers
 * @param isPublic  - value returned by reflector for IS_PUBLIC_KEY
 */
function makeContext(
  headers: Record<string, string | undefined>,
  isPublic: boolean,
): { ctx: ExecutionContext; requestObj: Record<string, unknown> } {
  const requestObj: Record<string, unknown> = { headers };

  const ctx = {
    getHandler: jest.fn().mockReturnValue({}),
    getClass: jest.fn().mockReturnValue({}),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(requestObj),
    }),
    // reflector.getAllAndOverride is mocked at the service level; we still need
    // these two methods available on the context object.
    _isPublic: isPublic,
  } as unknown as ExecutionContext;

  return { ctx, requestObj };
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: Reflector,
          useValue: { getAllAndOverride: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { verify: jest.fn() },
        },
      ],
    }).compile();

    guard = module.get(JwtAuthGuard);
    reflector = module.get(Reflector);
    jwtService = module.get(JwtService);
  });

  // ── @Public route — skip JWT check ─────────────────────────────────────────

  describe('public route (@Public decorator)', () => {
    it('returns true without checking authorization header', () => {
      reflector.getAllAndOverride.mockReturnValue(true); // isPublic = true

      const { ctx } = makeContext({}, true);
      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(jwtService.verify).not.toHaveBeenCalled();
    });

    it('does not call jwtService.verify on a public route', () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const { ctx } = makeContext({ authorization: 'Bearer some-token' }, true);

      guard.canActivate(ctx);

      expect(jwtService.verify).not.toHaveBeenCalled();
    });
  });

  // ── missing / malformed authorization header ────────────────────────────────

  describe('missing or invalid Bearer token', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(false); // isPublic = false
    });

    it('throws UnauthorizedException when authorization header is absent', () => {
      const { ctx } = makeContext({}, false);

      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when authorization header is empty string', () => {
      const { ctx } = makeContext({ authorization: '' }, false);

      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when header does not start with "Bearer "', () => {
      const { ctx } = makeContext({ authorization: 'Basic dXNlcjpwYXNz' }, false);

      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when header has only "Bearer" without a token', () => {
      // "Bearer" without trailing space — does not match startsWith('Bearer ')
      const { ctx } = makeContext({ authorization: 'Bearer' }, false);

      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });
  });

  // ── invalid (bad signature / expired) token ─────────────────────────────────

  describe('invalid token', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(false);
    });

    it('throws UnauthorizedException when jwtService.verify throws', () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });
      const { ctx } = makeContext({ authorization: 'Bearer bad.token.here' }, false);

      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('calls jwtService.verify with the token part only (no "Bearer " prefix)', () => {
      const payload = makePayload();
      jwtService.verify.mockReturnValue(payload);
      const { ctx } = makeContext({ authorization: 'Bearer valid.jwt.token' }, false);

      guard.canActivate(ctx);

      expect(jwtService.verify).toHaveBeenCalledWith('valid.jwt.token');
    });
  });

  // ── valid token ─────────────────────────────────────────────────────────────

  describe('valid token', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(false);
    });

    it('returns true when jwtService.verify succeeds', () => {
      const payload = makePayload();
      jwtService.verify.mockReturnValue(payload);
      const { ctx } = makeContext({ authorization: 'Bearer valid.jwt.token' }, false);

      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('attaches verified payload to request.user', () => {
      const payload = makePayload({ is_admin: true });
      jwtService.verify.mockReturnValue(payload);
      const { ctx, requestObj } = makeContext(
        { authorization: 'Bearer valid.jwt.token' },
        false,
      );

      guard.canActivate(ctx);

      expect(requestObj['user']).toEqual(payload);
    });

    it('works correctly for an admin user payload', () => {
      const payload = makePayload({ is_admin: true, email: 'admin@foosball.test' });
      jwtService.verify.mockReturnValue(payload);
      const { ctx, requestObj } = makeContext(
        { authorization: 'Bearer admin.jwt.token' },
        false,
      );

      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
      expect((requestObj['user'] as JwtPayload).is_admin).toBe(true);
    });
  });

  // ── reflector integration ───────────────────────────────────────────────────

  describe('reflector usage', () => {
    it('queries both handler and class for IS_PUBLIC_KEY', () => {
      const handler = jest.fn();
      const cls = jest.fn();

      const ctx = {
        getHandler: jest.fn().mockReturnValue(handler),
        getClass: jest.fn().mockReturnValue(cls),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ headers: {} }),
        }),
      } as unknown as ExecutionContext;

      reflector.getAllAndOverride.mockReturnValue(true);

      guard.canActivate(ctx);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        handler,
        cls,
      ]);
    });
  });
});
