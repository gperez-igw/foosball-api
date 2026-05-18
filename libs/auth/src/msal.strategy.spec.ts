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
 * This file therefore tests that layer (claims extraction + role derivation),
 * satisfying the spec naming requirement.  The deviation is noted in
 * .agentflow/teams/team-01/backend/progress-auth.md.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AzureAdService } from './azure-ad.service';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { RefreshTokenService } from './refresh-token.service';
import { UserService } from '@app/users/user.service';
import { UserEntity } from '@app/users/user.entity';
import { RefreshTokenEntity } from './refresh-token.entity';

// ── Mock MSAL module ──────────────────────────────────────────────────────────
jest.mock('@azure/msal-node', () => ({
  ConfidentialClientApplication: jest.fn().mockImplementation(() => ({
    getAuthCodeUrl: jest.fn(),
    acquireTokenByCode: jest.fn(),
  })),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
const ADMIN_GROUP = 'admin-group-id';

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
 * Build a mock MSAL AuthenticationResult with configurable claims.
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
  let refreshTokenService: jest.Mocked<RefreshTokenService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: AzureAdService,
          useValue: {
            getAuthCodeUrl: jest.fn(),
            exchangeCode: jest.fn(),
            getGroupsFromGraph: jest.fn(),
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
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue(ADMIN_GROUP) },
        },
      ],
    }).compile();

    authService = module.get(AuthService);
    azureAdService = module.get(AzureAdService);
    userService = module.get(UserService);
    tokenService = module.get(TokenService);
    refreshTokenService = module.get(RefreshTokenService);
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

    it('calls MSAL exchangeCode with the supplied code and state', async () => {
      azureAdService.exchangeCode.mockResolvedValue(msalResult({ groups: [ADMIN_GROUP] }) as any);
      userService.upsertFromAzure.mockResolvedValue(makeUser({ isAdmin: true }));
      tokenService.issueTokenPair.mockResolvedValue(makeTokenPair());

      await authService.handleCallback('my-code', 'my-state');

      expect(azureAdService.exchangeCode).toHaveBeenCalledWith('my-code', 'my-state');
    });
  });

  // ── Claims extraction ────────────────────────────────────────────────────────

  describe('claims extraction — oid, email, displayName', () => {
    it('extracts azure_oid from the oid claim', async () => {
      azureAdService.exchangeCode.mockResolvedValue(
        msalResult({ oid: 'unique-oid-xyz', groups: [] }) as any,
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
        msalResult({ preferred_username: 'mario@company.it', groups: [] }) as any,
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
        groups: [],
      };
      // no preferred_username key
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
        msalResult({ name: 'Displayed Name', groups: [] }) as any,
      );
      userService.upsertFromAzure.mockResolvedValue(makeUser());
      tokenService.issueTokenPair.mockResolvedValue(makeTokenPair());

      await authService.handleCallback('code', 'state');

      expect(userService.upsertFromAzure).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'Displayed Name' }),
      );
    });
  });

  // ── Admin role assignment from groups claim ─────────────────────────────────

  describe('role assignment from groups claim', () => {
    it('assigns is_admin=true when groups array contains the admin group ID', async () => {
      azureAdService.exchangeCode.mockResolvedValue(
        msalResult({ groups: [ADMIN_GROUP, 'other-group'] }) as any,
      );
      const adminUser = makeUser({ isAdmin: true });
      userService.upsertFromAzure.mockResolvedValue(adminUser);
      tokenService.issueTokenPair.mockResolvedValue(makeTokenPair());

      await authService.handleCallback('code', 'state');

      expect(userService.upsertFromAzure).toHaveBeenCalledWith(
        expect.objectContaining({ isAdmin: true }),
      );
    });

    it('assigns is_admin=false when groups array does not contain the admin group ID', async () => {
      azureAdService.exchangeCode.mockResolvedValue(
        msalResult({ groups: ['other-group', 'yet-another-group'] }) as any,
      );
      userService.upsertFromAzure.mockResolvedValue(makeUser({ isAdmin: false }));
      tokenService.issueTokenPair.mockResolvedValue(makeTokenPair());

      await authService.handleCallback('code', 'state');

      expect(userService.upsertFromAzure).toHaveBeenCalledWith(
        expect.objectContaining({ isAdmin: false }),
      );
    });

    it('assigns is_admin=false when groups array is empty', async () => {
      azureAdService.exchangeCode.mockResolvedValue(
        msalResult({ groups: [] }) as any,
      );
      userService.upsertFromAzure.mockResolvedValue(makeUser({ isAdmin: false }));
      tokenService.issueTokenPair.mockResolvedValue(makeTokenPair());

      await authService.handleCallback('code', 'state');

      expect(userService.upsertFromAzure).toHaveBeenCalledWith(
        expect.objectContaining({ isAdmin: false }),
      );
    });
  });

  // ── Missing groups claim (cap exceeded) ─────────────────────────────────────

  describe('missing groups claim — Graph API fallback', () => {
    it('calls getGroupsFromGraph when _claim_names.groups is present', async () => {
      azureAdService.exchangeCode.mockResolvedValue(
        msalResult({ _claim_names: { groups: 'src1' } }) as any,
      );
      azureAdService.getGroupsFromGraph.mockResolvedValue([ADMIN_GROUP]);
      userService.upsertFromAzure.mockResolvedValue(makeUser({ isAdmin: true }));
      tokenService.issueTokenPair.mockResolvedValue(makeTokenPair());

      await authService.handleCallback('code', 'state');

      expect(azureAdService.getGroupsFromGraph).toHaveBeenCalled();
      expect(userService.upsertFromAzure).toHaveBeenCalledWith(
        expect.objectContaining({ isAdmin: true }),
      );
    });

    it('assigns is_admin=false when Graph returns groups that do not include admin group', async () => {
      azureAdService.exchangeCode.mockResolvedValue(
        msalResult({ _claim_names: { groups: 'src1' } }) as any,
      );
      azureAdService.getGroupsFromGraph.mockResolvedValue(['non-admin-group']);
      userService.upsertFromAzure.mockResolvedValue(makeUser({ isAdmin: false }));
      tokenService.issueTokenPair.mockResolvedValue(makeTokenPair());

      await authService.handleCallback('code', 'state');

      expect(userService.upsertFromAzure).toHaveBeenCalledWith(
        expect.objectContaining({ isAdmin: false }),
      );
    });

    it('does NOT call getGroupsFromGraph when groups claim is present', async () => {
      azureAdService.exchangeCode.mockResolvedValue(
        msalResult({ groups: ['some-group'] }) as any,
      );
      userService.upsertFromAzure.mockResolvedValue(makeUser());
      tokenService.issueTokenPair.mockResolvedValue(makeTokenPair());

      await authService.handleCallback('code', 'state');

      expect(azureAdService.getGroupsFromGraph).not.toHaveBeenCalled();
    });

    it('does NOT call getGroupsFromGraph when neither groups nor _claim_names is present', async () => {
      // No groups at all — user simply has no group membership
      const claims = {
        oid: 'oid-1',
        preferred_username: 'user@co.it',
        name: 'User',
      };
      azureAdService.exchangeCode.mockResolvedValue({
        accessToken: 'tok',
        idTokenClaims: claims,
      } as any);
      userService.upsertFromAzure.mockResolvedValue(makeUser({ isAdmin: false }));
      tokenService.issueTokenPair.mockResolvedValue(makeTokenPair());

      await authService.handleCallback('code', 'state');

      expect(azureAdService.getGroupsFromGraph).not.toHaveBeenCalled();
      expect(userService.upsertFromAzure).toHaveBeenCalledWith(
        expect.objectContaining({ isAdmin: false }),
      );
    });

    it('propagates ServiceUnavailableException when Graph API is unavailable', async () => {
      azureAdService.exchangeCode.mockResolvedValue(
        msalResult({ _claim_names: { groups: 'src1' } }) as any,
      );
      azureAdService.getGroupsFromGraph.mockRejectedValue(
        new ServiceUnavailableException({
          code: 'AZURE_GRAPH_UNAVAILABLE',
          message: 'Graph unavailable',
        }),
      );

      await expect(authService.handleCallback('code', 'state')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  // ── Token pair structure ─────────────────────────────────────────────────────

  describe('token pair issuing', () => {
    it('returns a token pair with expiresIn=900', async () => {
      azureAdService.exchangeCode.mockResolvedValue(
        msalResult({ groups: [ADMIN_GROUP] }) as any,
      );
      userService.upsertFromAzure.mockResolvedValue(makeUser({ isAdmin: true }));
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
      azureAdService.exchangeCode.mockResolvedValue(
        msalResult({ groups: [] }) as any,
      );
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
