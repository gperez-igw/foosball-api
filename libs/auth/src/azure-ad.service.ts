import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as msal from '@azure/msal-node';

@Injectable()
export class AzureAdService {
  private readonly logger = new Logger(AzureAdService.name);
  private readonly confidentialClient: msal.ConfidentialClientApplication;
  private readonly redirectUri: string;

  constructor(private readonly config: ConfigService) {
    const tenantId = this.config.getOrThrow<string>('AZURE_TENANT_ID');
    const clientId = this.config.getOrThrow<string>('AZURE_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('AZURE_CLIENT_SECRET');
    this.redirectUri = this.config.getOrThrow<string>('AZURE_REDIRECT_URI');

    this.confidentialClient = new msal.ConfidentialClientApplication({
      auth: {
        clientId,
        clientSecret,
        authority: `https://login.microsoftonline.com/${tenantId}`,
      },
    });
  }

  getAuthCodeUrl(): Promise<string> {
    return this.confidentialClient.getAuthCodeUrl({
      scopes: ['openid', 'profile', 'email', 'offline_access'],
      redirectUri: this.redirectUri,
    });
  }

  async exchangeCode(code: string, state: string): Promise<msal.AuthenticationResult> {
    const result = await this.confidentialClient.acquireTokenByCode({
      code,
      scopes: ['openid', 'profile', 'email', 'offline_access'],
      redirectUri: this.redirectUri,
    });

    if (!result) {
      throw new Error('MSAL returned null token result');
    }

    return result;
  }

  async getGroupsFromGraph(accessToken: string): Promise<string[]> {
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch('https://graph.microsoft.com/v1.0/me/memberOf?$select=id', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          if (attempt < maxRetries) {
            this.logger.warn(`Graph API attempt ${attempt} failed with status ${response.status}, retrying...`);
            continue;
          }
          throw new ServiceUnavailableException({
            code: 'AZURE_GRAPH_UNAVAILABLE',
            message: 'Could not resolve group membership via Microsoft Graph',
          });
        }

        const data = await response.json() as { value: Array<{ id: string }> };
        return data.value.map((g) => g.id);
      } catch (err) {
        if (err instanceof ServiceUnavailableException) throw err;
        if (attempt < maxRetries) {
          this.logger.warn(`Graph API attempt ${attempt} threw error, retrying...`);
          continue;
        }
        throw new ServiceUnavailableException({
          code: 'AZURE_GRAPH_UNAVAILABLE',
          message: 'Could not resolve group membership via Microsoft Graph',
        });
      }
    }

    throw new ServiceUnavailableException({
      code: 'AZURE_GRAPH_UNAVAILABLE',
      message: 'Could not resolve group membership via Microsoft Graph',
    });
  }
}
