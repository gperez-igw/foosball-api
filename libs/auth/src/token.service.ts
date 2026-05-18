import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserEntity } from '@app/users/user.entity';
import { RefreshTokenService } from './refresh-token.service.js';

export interface JwtPayload {
  sub: number;
  email: string;
  is_admin: boolean;
  azure_oid: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class TokenService {
  private readonly refreshTtlMs: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {
    this.refreshTtlMs = 24 * 60 * 60 * 1000; // 24 hours
  }

  async issueTokenPair(user: UserEntity): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      is_admin: user.isAdmin,
      azure_oid: user.azureOid,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.refreshTokenService.issue(user.id, this.refreshTtlMs);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
    };
  }

  decodeToken(token: string): JwtPayload {
    return this.jwtService.decode(token) as JwtPayload;
  }
}
