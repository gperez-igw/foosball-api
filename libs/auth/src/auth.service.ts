import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AzureAdService } from './azure-ad.service.js';
import { TokenService, TokenPair } from './token.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { UserService } from '@app/users/user.service.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly adminGroupId: string;
  private readonly refreshTtlMs = 24 * 60 * 60 * 1000;

  constructor(
    private readonly azureAdService: AzureAdService,
    private readonly tokenService: TokenService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly userService: UserService,
    private readonly config: ConfigService,
  ) {
    this.adminGroupId = this.config.getOrThrow<string>('ADMIN_AZURE_GROUP_ID');
  }

  getLoginUrl(): Promise<string> {
    return this.azureAdService.getAuthCodeUrl();
  }

  async handleCallback(code: string, state: string): Promise<TokenPair> {
    if (!code || !state) {
      throw new BadRequestException({
        code: 'INVALID_CALLBACK',
        message: 'Missing or invalid authorization code',
      });
    }

    const msalResult = await this.azureAdService.exchangeCode(code, state);

    const idTokenClaims = msalResult.idTokenClaims as Record<string, unknown>;
    const azureOid = idTokenClaims['oid'] as string;
    const email = (idTokenClaims['preferred_username'] ?? idTokenClaims['email']) as string;
    const displayName = (idTokenClaims['name'] ?? email) as string;

    let isAdmin = false;
    const groupsInToken = idTokenClaims['groups'] as string[] | undefined;
    const claimNames = idTokenClaims['_claim_names'] as Record<string, string> | undefined;

    if (groupsInToken) {
      isAdmin = groupsInToken.includes(this.adminGroupId);
    } else if (claimNames?.groups) {
      // Groups claim was capped — fall back to Graph API
      const graphToken = msalResult.accessToken;
      const graphGroups = await this.azureAdService.getGroupsFromGraph(graphToken);
      isAdmin = graphGroups.includes(this.adminGroupId);
    }

    const user = await this.userService.upsertFromAzure({ azureOid, email, displayName, isAdmin });
    return this.tokenService.issueTokenPair(user);
  }

  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    const tokenEntity = await this.refreshTokenService.validate(rawRefreshToken);
    const user = await this.userService.findById(tokenEntity.userId);
    const newRawToken = await this.refreshTokenService.rotate(tokenEntity, user.id, this.refreshTtlMs);

    const accessToken = (await this.tokenService.issueTokenPair(user)).accessToken;

    return {
      accessToken,
      refreshToken: newRawToken,
      expiresIn: 900,
    };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    await this.refreshTokenService.invalidate(rawRefreshToken);
  }
}
