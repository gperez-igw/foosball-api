import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '@app/auth/auth.service';
import { UserService } from '@app/users/user.service';
import { JwtAuthGuard } from '@app/auth/jwt-auth.guard';
import { Public } from '@app/auth/public.decorator';
import type { JwtPayload } from '@app/auth/token.service';

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
  async login(
    @Query('client') client: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const clientType = client === 'mobile' ? 'mobile' : 'web';
    const url = await this.authService.getLoginUrl(clientType);
    if (clientType === 'mobile') {
      reply.status(200).send({ url });
    } else {
      reply.redirect(url, 302);
    }
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
