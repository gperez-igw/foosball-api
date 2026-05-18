/**
 * msal.strategy.spec.ts
 *
 * test-criteria.md § Unit tests — backend-auth:
 *   "libs/auth/src/msal.strategy.spec.ts | validates token, extracts claims,
 *    handles missing groups | 80%+"
 *
 * Design note: this project does not implement a Passport MsalStrategy class.
 * The MSAL token exchange and claims extraction logic lives entirely in
 * AzureAdService.exchangeCode() and AuthService.handleCallback().
 * This file therefore tests that layer (claims extraction + identity),
 * satisfying the spec naming requirement. The deviation is noted in
 * .agentflow/teams/team-01/backend/progress-auth.md.
 *
 * Since admin status is now DB-managed (feature-admin-db-managed), the
 * handleCallback path no longer reads any groups claim or calls Graph API.
 * Tests reflect the simplified flow: identity claims only (oid, email, name).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AzureAdService } from './azure-ad.service';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { RefreshTokenService } from './refresh-token.service';
import { UserService } from '@app/users/user.service';
import { UserEntity } from '@app/users/user.entity';

// ── Mock MSAL module ──────────────────────────────────────────────────────────
jest.mock('@azure/msal-node', () => ({
  ConfidentialClientApplication: jest.fn().mockImplementation(() => ({
    getAuthCodeUrl: jest.fn(),
    acquireTokenByCode: jest.fn(),
  })),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<UserEntity> = {}): UserEntity {
  const u = new UserEntity();
  u.id = 1;
  u.azureOid = 'azure-oid-001';
  u.email = 'test@foosball.test';
  u.displayName = 'Test User';
  u.isAdmin = false;
  u.createdAt = new Date();
  u.updatedAt = new Date();
  return Object.assign(u, overrides);
}

function makeTokenPair() {
  return { accessToken: 'jwt-token', refreshToken: 'refresh-token', expiresIn: 900 };
}

/**
 * Build a mock MSAL AuthenticationResult with identity claims only.
 */
function msalResult(claims: Record<string, unknown> = {}) {
  return {
    accessToken: 'graph-access-token',
    idTokenClaims: {
      oid: 'azure-oid-001',
      preferred_username: 'test@foosball.test',
      name: 'Test User',
      ...claims,
    },
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('MSAL token validation and claims extraction (via AzureAdService + AuthService)', () => {
  let authService: AuthService;
  let azureAdService: jest.Mocked<AzureAdService>;
  let userService: jest.Mocked<UserService>;
  let tokenService: jest.Mocked<TokenService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: AzureAdService,
          useValue: {
            webRedirectUri: 'http://localhost:3001/connect',
            mobileRedirectUri: 'foosball://auth/callback',
            getAuthCodeUrl: jest.fn(),
            exchangeCode: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: { issueTokenPair: jest.fn() },
        },
        {
          provide: RefreshTokenService,
          useValue: {
            validate: jest.fn(),
            rotate: jest.fn(),
            invalidate: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            upsertFromAzure: jest.fn(),
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    authService = module.get(AuthService);
    azureAdService = module.get(AzureAdService);
    userService = module.get(UserService);
    tokenService = module.get(TokenService);
  });

  // ── Token validation ────────────────────────────────────────────────────────

  describe('token validation', () => {
    it('rejects callback when code is empty (missing authorization code)', async () => {
      await expect(authService.handleCallback('', 'state')).rejects.toThrow(
        /authorization code|BadRequest/i,
      );
      expect(azureAdService.exchangeCode).not.toHaveBeenCalled();
    });

    it('rejects callback when state is empty', async () => {
      await expect(authService.handleCallback('code', '')).rejects.toThrow();
    });

    it('calls MSAL exchangeCode with the supplied code, state, and webRedirectUri', async () => {
      azureAdService.exchangeCode.mockResolvedValue(msalResult() as any);
      userService.upsertFromAzure.mockResolvedValue(makeUser());
      tokenService.issueTokenPair.mockResolvedValue(makeTokenPair());

      await authService.handleCallback('my-code', 'my-state');

      expect(azureAdService.exchangeCode).toHaveBeenCalledWith(
        'my-code',
        'my-state',
        'http://localhost:3001/connect',
      );
    });
  });

  // ── Claims extraction ────────────────────────────────────────────────────────

  describe('claims extraction — oid, email, displayName', () => {
    it('extracts azure_oid from the oid claim', async () => {
      azureAdService.exchangeCode.mockResolvedValue(
        msalResult({ oid: 'unique-oid-xyz' }) as any,
      );
      userService.upsertFromAzure.mockResolvedValue(makeUser());
      tokenService.issueTokenPair.mockResolvedValue(makeTokenPair());

      await authService.handleCallback('code', 'state');

      expect(userService.upsertFromAzure).toHaveBeenCalledWith(
        expect.objectContaining({ azureOid: 'unique-oid-xyz' }),
      );
    });

    it('uses preferred_username as email when present', async () => {
      azureAdService.exchangeCode.mockResolvedValue(
        msalResult({ preferred_username: 'mario@company.it' }) as any,
      );
      userService.upsertFromAzure.mockResolvedValue(makeUser());
      tokenService.issueTokenPair.mockResolvedValue(makeTokenPair());

      await authService.handleCallback('code', 'state');

      expect(userService.upsertFromAzure).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'mario@company.it' }),
      );
    });

    it('falls back to email claim when preferred_username is absent', async () => {
      const claims = {
        oid: 'oid-1',
        email: 'fallback@company.it',
        name: 'Fallback User',
      };
      azureAdService.exchangeCode.mockResolvedValue({ accessToken: 'tok', idTokenClaims: claims } as any);
      userService.upsertFromAzure.mockResolvedValue(makeUser());
      tokenService.issueTokenPair.mockResolvedValue(makeTokenPair());

      await authService.handleCallback('code', 'state');

      expect(userService.upsertFromAzure).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'fallback@company.it' }),
      );
    });

    it('extracts displayName from the name claim', async () => {
      azureAdService.exchangeCode.mockResolvedValue(
        msalResult({ name: 'Displayed Name' }) as any,
      );
      userService.upsertFromAzure.mockResolvedValue(makeUser());
      tokenService.issueTokenPair.mockResolvedValue(makeTokenPair());

      await authService.handleCallback('code', 'state');

      expect(userService.upsertFromAzure).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'Displayed Name' }),
      );
    });
  });

  // ── DB-managed admin — no groups claim processing ───────────────────────────

  describe('DB-managed admin — is_admin not derived from Azure claims', () => {
    it('does NOT pass isAdmin to upsertFromAzure', async () => {
      azureAdService.exchangeCode.mockResolvedValue(msalResult() as any);
      userService.upsertFromAzure.mockResolvedValue(makeUser());
      tokenService.issueTokenPair.mockResolvedValue(makeTokenPair());

      await authService.handleCallback('code', 'state');

      const callArg = userService.upsertFromAzure.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('isAdmin');
    });

    it('JWT reflects is_admin from DB row (user returned by upsert), not from token claims', async () => {
      azureAdService.exchangeCode.mockResolvedValue(msalResult() as any);
      const adminUser = makeUser({ isAdmin: true });
      userService.upsertFromAzure.mockResolvedValue(adminUser);
      tokenService.issueTokenPair.mockResolvedValue(makeTokenPair());

      await authService.handleCallback('code', 'state');

      expect(tokenService.issueTokenPair).toHaveBeenCalledWith(adminUser);
    });

    it('new user login: upsert is called without groups — DB sets default false', async () => {
      azureAdService.exchangeCode.mockResolvedValue(msalResult() as any);
      const newUser = makeUser({ isAdmin: false });
      userService.upsertFromAzure.mockResolvedValue(newUser);
      tokenService.issueTokenPair.mockResolvedValue(makeTokenPair());

      await authService.handleCallback('code', 'state');

      expect(userService.upsertFromAzure).toHaveBeenCalledWith({
        azureOid: 'azure-oid-001',
        email: 'test@foosball.test',
        displayName: 'Test User',
      });
    });

    it('existing admin user: upsert preserves is_admin (returned by repo), token reflects true', async () => {
      azureAdService.exchangeCode.mockResolvedValue(msalResult() as any);
      const existingAdmin = makeUser({ isAdmin: true });
      userService.upsertFromAzure.mockResolvedValue(existingAdmin);
      tokenService.issueTokenPair.mockResolvedValue({
        accessToken: 'admin-jwt',
        refreshToken: 'refresh',
        expiresIn: 900,
      });

      const result = await authService.handleCallback('code', 'state');

      expect(tokenService.issueTokenPair).toHaveBeenCalledWith(existingAdmin);
      expect(result.accessToken).toBe('admin-jwt');
    });

    it('groups claim in token is ignored — no effect on upsert call', async () => {
      // Even if the token has groups, they must be completely ignored
      azureAdService.exchangeCode.mockResolvedValue(
        msalResult({ groups: ['admin-group-id', 'other-group'] }) as any,
      );
      userService.upsertFromAzure.mockResolvedValue(makeUser({ isAdmin: false }));
      tokenService.issueTokenPair.mockResolvedValue(makeTokenPair());

      await authService.handleCallback('code', 'state');

      const callArg = userService.upsertFromAzure.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('isAdmin');
      expect(callArg).toEqual({
        azureOid: 'azure-oid-001',
        email: 'test@foosball.test',
        displayName: 'Test User',
      });
    });
  });

  // ── Token pair structure ─────────────────────────────────────────────────────

  describe('token pair issuing', () => {
    it('returns a token pair with expiresIn=900', async () => {
      azureAdService.exchangeCode.mockResolvedValue(msalResult() as any);
      userService.upsertFromAzure.mockResolvedValue(makeUser());
      tokenService.issueTokenPair.mockResolvedValue({
        accessToken: 'access-jwt',
        refreshToken: 'refresh-raw',
        expiresIn: 900,
      });

      const result = await authService.handleCallback('code', 'state');

      expect(result.expiresIn).toBe(900);
      expect(result.accessToken).toBe('access-jwt');
      expect(result.refreshToken).toBe('refresh-raw');
    });

    it('calls userService.upsertFromAzure before issuing tokens', async () => {
      const callOrder: string[] = [];
      azureAdService.exchangeCode.mockResolvedValue(msalResult() as any);
      userService.upsertFromAzure.mockImplementation(async () => {
        callOrder.push('upsert');
        return makeUser();
      });
      tokenService.issueTokenPair.mockImplementation(async () => {
        callOrder.push('issue');
        return makeTokenPair();
      });

      await authService.handleCallback('code', 'state');

      expect(callOrder).toEqual(['upsert', 'issue']);
    });
  });
});
