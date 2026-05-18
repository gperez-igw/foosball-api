import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '@app/auth/auth.service';
import { JwtAuthGuard } from '@app/auth/jwt-auth.guard';
import { Public } from '@app/auth/public.decorator';

@Controller()
@UseGuards(JwtAuthGuard)
export class ConnectController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('connect')
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
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @Post('connect/exchange')
  async mobileExchange(
    @Body() body: { code?: string; state?: string },
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (!body?.code || !body?.state) {
      reply.status(400).send({
        error: {
          code: 'INVALID_CALLBACK',
          message: 'Missing or invalid authorization code',
        },
      });
      return;
    }
    const tokenPair = await this.authService.handleMobileExchange(
      body.code,
      body.state,
    );
    reply.status(200).send(tokenPair);
  }
}
