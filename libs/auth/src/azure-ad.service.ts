import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as msal from '@azure/msal-node';

@Injectable()
export class AzureAdService {
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
}
