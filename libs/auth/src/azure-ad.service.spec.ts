import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
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
        groups: ['admin-group-id'],
      },
    }),
  })),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('AzureAdService', () => {
  let service: AzureAdService;

  const configValues: Record<string, string> = {
    AZURE_TENANT_ID: 'test-tenant',
    AZURE_CLIENT_ID: 'test-client-id',
    AZURE_CLIENT_SECRET: 'test-client-secret',
    AZURE_REDIRECT_URI: 'http://localhost:3001/auth/callback',
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
    mockFetch.mockReset();
  });

  describe('getGroupsFromGraph', () => {
    it('should return group IDs from Graph API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [{ id: 'group-1' }, { id: 'group-2' }] }),
      });

      const groups = await service.getGroupsFromGraph('mock-access-token');
      expect(groups).toEqual(['group-1', 'group-2']);
    });

    it('should retry once on transient 503 and succeed on second attempt', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ value: [{ id: 'group-1' }] }),
        });

      const groups = await service.getGroupsFromGraph('mock-access-token');
      expect(groups).toEqual(['group-1']);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw ServiceUnavailableException when both attempts fail', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: false, status: 503 });

      await expect(service.getGroupsFromGraph('mock-access-token')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
