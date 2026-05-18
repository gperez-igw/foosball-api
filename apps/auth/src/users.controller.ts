import {
  Controller,
  Get,
  Patch,
  Req,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '@app/auth/jwt-auth.guard';
import { UserService } from '@app/users/user.service';
import type { JwtPayload } from '@app/auth/token.service';

interface AuthRequest {
  user: JwtPayload;
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getProfile(@Req() req: AuthRequest) {
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

  @Patch('me')
  async updateProfile(@Req() req: AuthRequest, @Body() body: { displayName?: string }) {
    if (!body?.displayName) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'displayName is required',
      });
    }

    const user = req.user;
    const updated = await this.userService.updateDisplayName(user.sub, body.displayName);
    return {
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      isAdmin: updated.isAdmin,
      createdAt: updated.createdAt,
    };
  }
}
