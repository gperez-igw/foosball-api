import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AzureAdService } from './azure-ad.service';
import { TokenService } from './token.service';
import { RefreshTokenService } from './refresh-token.service';
import { UserService } from '@app/users/user.service';
import { ConfigService } from '@nestjs/config';
import { UserEntity } from '@app/users/user.entity';
import { RefreshTokenEntity } from './refresh-token.entity';

const mockUser = (): UserEntity => {
  const u = new UserEntity();
  u.id = 1;
  u.azureOid = 'azure-oid-123';
  u.email = 'mario.rossi@company.com';
  u.displayName = 'Mario Rossi';
  u.isAdmin = false;
  u.createdAt = new Date();
  u.updatedAt = new Date();
  return u;
};

const mockMsalResult = (overrides: Record<string, unknown> = {}) => ({
  accessToken: 'mock-graph-token',
  idTokenClaims: {
    oid: 'azure-oid-123',
    preferred_username: 'mario.rossi@company.com',
    name: 'Mario Rossi',
    groups: ['other-group'],
    ...overrides,
  },
});

describe('AuthService', () => {
  let service: AuthService;
  let azureAdService: jest.Mocked<AzureAdService>;
  let tokenService: jest.Mocked<TokenService>;
  let refreshTokenService: jest.Mocked<RefreshTokenService>;
  let userService: jest.Mocked<UserService>;

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
          useValue: { getOrThrow: jest.fn().mockReturnValue('admin-group-id') },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    azureAdService = module.get(AzureAdService);
    tokenService = module.get(TokenService);
    refreshTokenService = module.get(RefreshTokenService);
    userService = module.get(UserService);
  });

  describe('handleCallback', () => {
    it('should assign is_admin=true when user is in admin group', async () => {
      const result = mockMsalResult({ groups: ['admin-group-id', 'other-group'] });
      azureAdService.exchangeCode.mockResolvedValue(result as any);
      const user = mockUser();
      user.isAdmin = true;
      userService.upsertFromAzure.mockResolvedValue(user);
      tokenService.issueTokenPair.mockResolvedValue({
        accessToken: 'jwt-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
      });

      const tokens = await service.handleCallback('code', 'state');

      expect(userService.upsertFromAzure).toHaveBeenCalledWith(
        expect.objectContaining({ isAdmin: true }),
      );
      expect(tokens.expiresIn).toBe(900);
    });

    it('should assign is_admin=false when user is not in admin group', async () => {
      const result = mockMsalResult({ groups: ['other-group'] });
      azureAdService.exchangeCode.mockResolvedValue(result as any);
      const user = mockUser();
      userService.upsertFromAzure.mockResolvedValue(user);
      tokenService.issueTokenPair.mockResolvedValue({
        accessToken: 'jwt-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
      });

      await service.handleCallback('code', 'state');

      expect(userService.upsertFromAzure).toHaveBeenCalledWith(
        expect.objectContaining({ isAdmin: false }),
      );
    });

    it('should use Graph API fallback when _claim_names.groups present', async () => {
      const result = mockMsalResult({ groups: undefined, _claim_names: { groups: 'src1' } });
      azureAdService.exchangeCode.mockResolvedValue(result as any);
      azureAdService.getGroupsFromGraph.mockResolvedValue(['admin-group-id']);
      const user = mockUser();
      user.isAdmin = true;
      userService.upsertFromAzure.mockResolvedValue(user);
      tokenService.issueTokenPair.mockResolvedValue({
        accessToken: 'jwt-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
      });

      await service.handleCallback('code', 'state');

      expect(azureAdService.getGroupsFromGraph).toHaveBeenCalled();
      expect(userService.upsertFromAzure).toHaveBeenCalledWith(
        expect.objectContaining({ isAdmin: true }),
      );
    });

    it('should propagate AZURE_GRAPH_UNAVAILABLE when Graph API fails', async () => {
      const result = mockMsalResult({ groups: undefined, _claim_names: { groups: 'src1' } });
      azureAdService.exchangeCode.mockResolvedValue(result as any);
      azureAdService.getGroupsFromGraph.mockRejectedValue(
        new ServiceUnavailableException({ code: 'AZURE_GRAPH_UNAVAILABLE', message: 'Graph unavailable' }),
      );

      await expect(service.handleCallback('code', 'state')).rejects.toThrow(ServiceUnavailableException);
    });

    it('should throw BadRequestException when code is missing', async () => {
      await expect(service.handleCallback('', 'state')).rejects.toThrow(BadRequestException);
    });
  });

  describe('refresh', () => {
    it('should return new token pair on valid refresh token', async () => {
      const tokenEntity = new RefreshTokenEntity();
      tokenEntity.id = 1;
      tokenEntity.userId = 1;
      refreshTokenService.validate.mockResolvedValue(tokenEntity);
      const user = mockUser();
      userService.findById.mockResolvedValue(user);
      refreshTokenService.rotate.mockResolvedValue('new-raw-token');
      tokenService.issueTokenPair.mockResolvedValue({
        accessToken: 'new-jwt',
        refreshToken: 'placeholder',
        expiresIn: 900,
      });

      const result = await service.refresh('old-raw-token');

      expect(result.accessToken).toBe('new-jwt');
      expect(result.refreshToken).toBe('new-raw-token');
      expect(result.expiresIn).toBe(900);
    });
  });

  describe('logout', () => {
    it('should invalidate the refresh token', async () => {
      refreshTokenService.invalidate.mockResolvedValue(undefined);
      await service.logout('raw-token');
      expect(refreshTokenService.invalidate).toHaveBeenCalledWith('raw-token');
    });
  });
});
