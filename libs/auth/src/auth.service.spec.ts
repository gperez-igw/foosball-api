import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AzureAdService } from './azure-ad.service';
import { TokenService } from './token.service';
import { RefreshTokenService } from './refresh-token.service';
import { UserService } from '@app/users/user.service';
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

    service = module.get<AuthService>(AuthService);
    azureAdService = module.get(AzureAdService);
    tokenService = module.get(TokenService);
    refreshTokenService = module.get(RefreshTokenService);
    userService = module.get(UserService);
  });

  describe('handleCallback', () => {
    it('should upsert user with identity claims only — no isAdmin field', async () => {
      const result = mockMsalResult();
      azureAdService.exchangeCode.mockResolvedValue(result as any);
      const user = mockUser();
      userService.upsertFromAzure.mockResolvedValue(user);
      tokenService.issueTokenPair.mockResolvedValue({
        accessToken: 'jwt-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
      });

      const tokens = await service.handleCallback('code', 'state');

      expect(userService.upsertFromAzure).toHaveBeenCalledWith({
        azureOid: 'azure-oid-123',
        email: 'mario.rossi@company.com',
        displayName: 'Mario Rossi',
      });
      expect(tokens.expiresIn).toBe(900);
    });

    it('should not pass isAdmin to upsertFromAzure', async () => {
      const result = mockMsalResult();
      azureAdService.exchangeCode.mockResolvedValue(result as any);
      userService.upsertFromAzure.mockResolvedValue(mockUser());
      tokenService.issueTokenPair.mockResolvedValue({
        accessToken: 'jwt-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
      });

      await service.handleCallback('code', 'state');

      const callArg = userService.upsertFromAzure.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('isAdmin');
    });

    it('should throw BadRequestException when code is missing', async () => {
      await expect(service.handleCallback('', 'state')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when state is missing', async () => {
      await expect(service.handleCallback('code', '')).rejects.toThrow(BadRequestException);
    });

    it('should issue token pair from user returned by upsert', async () => {
      const result = mockMsalResult();
      azureAdService.exchangeCode.mockResolvedValue(result as any);
      const user = mockUser();
      user.isAdmin = true;
      userService.upsertFromAzure.mockResolvedValue(user);
      tokenService.issueTokenPair.mockResolvedValue({
        accessToken: 'jwt-admin',
        refreshToken: 'refresh-admin',
        expiresIn: 900,
      });

      const tokens = await service.handleCallback('code', 'state');

      expect(tokenService.issueTokenPair).toHaveBeenCalledWith(user);
      expect(tokens.accessToken).toBe('jwt-admin');
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
