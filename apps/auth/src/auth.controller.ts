import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '@app/auth/auth.service.js';
import { UserService } from '@app/users/user.service.js';
import { JwtAuthGuard } from '@app/auth/jwt-auth.guard.js';
import { Public } from '@app/auth/public.decorator.js';
import type { JwtPayload } from '@app/auth/token.service.js';

interface AuthRequest {
  user: JwtPayload;
}

@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Get('login')
  async login(@Res() reply: FastifyReply): Promise<void> {
    const url = await this.authService.getLoginUrl();
    reply.redirect(url, 302);
  }

  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (!code || !state) {
      reply.status(400).send({
        error: {
          code: 'INVALID_CALLBACK',
          message: 'Missing or invalid authorization code',
        },
      });
      return;
    }

    const tokenPair = await this.authService.handleCallback(code, state);
    reply.status(200).send(tokenPair);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: { refreshToken?: string }) {
    if (!body?.refreshToken || body.refreshToken.length < 32) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'refreshToken is required and must be at least 32 characters',
      });
    }
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: AuthRequest, @Body() body: { refreshToken?: string }): Promise<void> {
    if (!body?.refreshToken) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'refreshToken is required',
      });
    }
    await this.authService.logout(body.refreshToken);
  }

  @Get('me')
  async me(@Req() req: AuthRequest) {
    const user = req.user;
    const entity = await this.userService.findById(user.sub);
    return {
      id: entity.id,
      email: entity.email,
      displayName: entity.displayName,
      isAdmin: entity.isAdmin,
      createdAt: entity.createdAt,
    };
  }
}
