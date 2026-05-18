import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';
import { RefreshTokenService } from './refresh-token.service';
import { UserEntity } from '@app/users/user.entity';

// ── helpers ────────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<UserEntity> = {}): UserEntity {
  const u = new UserEntity();
  u.id = 7;
  u.azureOid = 'oid-007';
  u.email = 'test@foosball.test';
  u.displayName = 'Test Player';
  u.isAdmin = false;
  u.createdAt = new Date();
  u.updatedAt = new Date();
  return Object.assign(u, overrides);
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let refreshTokenService: jest.Mocked<RefreshTokenService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            decode: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(), getOrThrow: jest.fn() },
        },
        {
          provide: RefreshTokenService,
          useValue: { issue: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(TokenService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    refreshTokenService = module.get(RefreshTokenService);
  });

  // ── issueTokenPair ──────────────────────────────────────────────────────────

  describe('issueTokenPair', () => {
    it('returns a TokenPair with correct structure', async () => {
      jwtService.sign.mockReturnValue('signed-access-token');
      refreshTokenService.issue.mockResolvedValue('raw-refresh-token');

      const result = await service.issueTokenPair(makeUser());

      expect(result).toEqual({
        accessToken: 'signed-access-token',
        refreshToken: 'raw-refresh-token',
        expiresIn: 900,
      });
    });

    it('calls jwtService.sign with the correct payload shape', async () => {
      const user = makeUser({ id: 42, email: 'player@foosball.test', isAdmin: true, azureOid: 'oid-042' });
      jwtService.sign.mockReturnValue('jwt-token');
      refreshTokenService.issue.mockResolvedValue('refresh');

      await service.issueTokenPair(user);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 42,
        email: 'player@foosball.test',
        is_admin: true,
        azure_oid: 'oid-042',
      });
    });

    it('calls refreshTokenService.issue with user.id and a 24h TTL', async () => {
      const user = makeUser({ id: 99 });
      jwtService.sign.mockReturnValue('jwt');
      refreshTokenService.issue.mockResolvedValue('raw-refresh');

      await service.issueTokenPair(user);

      const expectedTtl = 24 * 60 * 60 * 1000;
      expect(refreshTokenService.issue).toHaveBeenCalledWith(99, expectedTtl);
    });

    it('uses the raw refresh token returned by refreshTokenService.issue', async () => {
      jwtService.sign.mockReturnValue('any-jwt');
      refreshTokenService.issue.mockResolvedValue('unique-raw-refresh-token');

      const result = await service.issueTokenPair(makeUser());

      expect(result.refreshToken).toBe('unique-raw-refresh-token');
    });

    it('always sets expiresIn=900', async () => {
      jwtService.sign.mockReturnValue('any-jwt');
      refreshTokenService.issue.mockResolvedValue('any-refresh');

      const result = await service.issueTokenPair(makeUser());

      expect(result.expiresIn).toBe(900);
    });

    it('maps isAdmin=false correctly to is_admin=false in payload', async () => {
      const user = makeUser({ isAdmin: false });
      jwtService.sign.mockReturnValue('jwt');
      refreshTokenService.issue.mockResolvedValue('refresh');

      await service.issueTokenPair(user);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ is_admin: false }),
      );
    });
  });

  // ── decodeToken ─────────────────────────────────────────────────────────────

  describe('decodeToken', () => {
    it('returns the decoded payload from jwtService.decode', () => {
      const payload = {
        sub: 1,
        email: 'mario@foosball.test',
        is_admin: false,
        azure_oid: 'oid-001',
      };
      jwtService.decode.mockReturnValue(payload as any);

      const result = service.decodeToken('some.jwt.token');

      expect(result).toEqual(payload);
      expect(jwtService.decode).toHaveBeenCalledWith('some.jwt.token');
    });

    it('passes the raw token string to jwtService.decode', () => {
      jwtService.decode.mockReturnValue({} as any);

      service.decodeToken('header.payload.sig');

      expect(jwtService.decode).toHaveBeenCalledWith('header.payload.sig');
    });

    it('returns admin payload when is_admin is true', () => {
      const adminPayload = {
        sub: 10,
        email: 'admin@foosball.test',
        is_admin: true,
        azure_oid: 'oid-admin',
      };
      jwtService.decode.mockReturnValue(adminPayload as any);

      const result = service.decodeToken('admin.jwt.token');

      expect(result.is_admin).toBe(true);
      expect(result.sub).toBe(10);
    });
  });
});
