import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as msal from '@azure/msal-node';

@Injectable()
export class AzureAdService {
  private readonly confidentialClient: msal.ConfidentialClientApplication;
  readonly webRedirectUri: string;
  readonly mobileRedirectUri: string;

  constructor(private readonly config: ConfigService) {
    const tenantId = this.config.getOrThrow<string>('AZURE_TENANT_ID');
    const clientId = this.config.getOrThrow<string>('AZURE_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('AZURE_CLIENT_SECRET');
    this.webRedirectUri = this.config.getOrThrow<string>('AZURE_REDIRECT_URI');
    this.mobileRedirectUri = this.config.getOrThrow<string>('AZURE_MOBILE_REDIRECT_URI');

    this.confidentialClient = new msal.ConfidentialClientApplication({
      auth: {
        clientId,
        clientSecret,
        authority: `https://login.microsoftonline.com/${tenantId}`,
      },
    });
  }

  getAuthCodeUrl(redirectUri: string): Promise<string> {
    return this.confidentialClient.getAuthCodeUrl({
      scopes: ['openid', 'profile', 'email', 'offline_access'],
      redirectUri,
    });
  }

  async exchangeCode(
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<msal.AuthenticationResult> {
    const result = await this.confidentialClient.acquireTokenByCode({
      code,
      scopes: ['openid', 'profile', 'email', 'offline_access'],
      redirectUri,
    });

    if (!result) {
      throw new Error('MSAL returned null token result');
    }

    return result;
  }
}
