import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { RefreshTokenEntity } from './refresh-token.entity.js';

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(RefreshTokenEntity)
    private readonly repo: Repository<RefreshTokenEntity>,
  ) {}

  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  async issue(userId: number, ttlMs: number): Promise<string> {
    const rawToken = crypto.randomBytes(48).toString('base64url');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + ttlMs);

    const entity = this.repo.create({ userId, tokenHash, expiresAt, usedAt: null, replacedBy: null });
    await this.repo.save(entity);

    return rawToken;
  }

  async validate(rawToken: string): Promise<RefreshTokenEntity> {
    const tokenHash = this.hashToken(rawToken);
    const token = await this.repo.findOne({ where: { tokenHash } });

    if (!token) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid, expired, or already used',
      });
    }

    if (token.usedAt !== null) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid, expired, or already used',
      });
    }

    if (token.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid, expired, or already used',
      });
    }

    return token;
  }

  async rotate(oldToken: RefreshTokenEntity, userId: number, ttlMs: number): Promise<string> {
    const rawToken = crypto.randomBytes(48).toString('base64url');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + ttlMs);

    const newEntity = this.repo.create({ userId, tokenHash, expiresAt, usedAt: null, replacedBy: null });
    const saved = await this.repo.save(newEntity);

    await this.repo.update(oldToken.id, { usedAt: new Date(), replacedBy: saved.id });

    return rawToken;
  }

  async invalidate(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    await this.repo.update({ tokenHash }, { usedAt: new Date() });
  }
}
