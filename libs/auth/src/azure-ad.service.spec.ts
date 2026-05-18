import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AzureAdService } from './azure-ad.service';

jest.mock('@azure/msal-node', () => ({
  ConfidentialClientApplication: jest.fn().mockImplementation(() => ({
    getAuthCodeUrl: jest.fn().mockResolvedValue('https://login.microsoftonline.com/authorize?...'),
    acquireTokenByCode: jest.fn().mockResolvedValue({
      accessToken: 'mock-access-token',
      idTokenClaims: {
        oid: 'azure-oid-123',
        preferred_username: 'mario.rossi@company.com',
        name: 'Mario Rossi',
      },
    }),
  })),
}));

describe('AzureAdService', () => {
  let service: AzureAdService;

  const configValues: Record<string, string> = {
    AZURE_TENANT_ID: 'test-tenant',
    AZURE_CLIENT_ID: 'test-client-id',
    AZURE_CLIENT_SECRET: 'test-client-secret',
    AZURE_REDIRECT_URI: 'http://localhost:3001/connect',
    AZURE_MOBILE_REDIRECT_URI: 'foosball://auth/callback',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AzureAdService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => configValues[key]),
          },
        },
      ],
    }).compile();

    service = module.get<AzureAdService>(AzureAdService);
  });

  describe('properties', () => {
    it('exposes webRedirectUri from config', () => {
      expect(service.webRedirectUri).toBe('http://localhost:3001/connect');
    });

    it('exposes mobileRedirectUri from config', () => {
      expect(service.mobileRedirectUri).toBe('foosball://auth/callback');
    });
  });

  describe('getAuthCodeUrl', () => {
    it('should return an authorization URL when called with webRedirectUri', async () => {
      const url = await service.getAuthCodeUrl(service.webRedirectUri);
      expect(typeof url).toBe('string');
      expect(url).toContain('login.microsoftonline.com');
    });

    it('should return an authorization URL when called with mobileRedirectUri', async () => {
      const url = await service.getAuthCodeUrl(service.mobileRedirectUri);
      expect(typeof url).toBe('string');
      expect(url).toContain('login.microsoftonline.com');
    });
  });

  describe('exchangeCode', () => {
    it('should return an AuthenticationResult on success with webRedirectUri', async () => {
      const result = await service.exchangeCode('auth-code', 'state', service.webRedirectUri);
      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mock-access-token');
      expect((result.idTokenClaims as Record<string, unknown>)['oid']).toBe('azure-oid-123');
    });

    it('should return an AuthenticationResult on success with mobileRedirectUri', async () => {
      const result = await service.exchangeCode('auth-code', 'state', service.mobileRedirectUri);
      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mock-access-token');
    });
  });
});
