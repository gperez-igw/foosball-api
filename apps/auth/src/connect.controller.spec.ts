import { Test, TestingModule } from '@nestjs/testing';
import { ConnectController } from './connect.controller';
import { AuthService } from '@app/auth/auth.service';
import type { FastifyReply } from 'fastify';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeFastifyReply(): jest.Mocked<Pick<FastifyReply, 'status' | 'send'>> & { status: jest.Mock } {
  const reply: any = {
    send: jest.fn(),
    status: jest.fn(),
  };
  // status(n).send(...) chaining
  reply.status.mockReturnValue(reply);
  return reply;
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('ConnectController', () => {
  let controller: ConnectController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConnectController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            handleCallback: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(require('@app/auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ConnectController>(ConnectController);
    authService = module.get(AuthService);
  });

  // ── GET /connect ───────────────────────────────────────────────────────────

  describe('callback()', () => {
    it('sends 200 with token pair when code and state are present', async () => {
      const tokenPair = { accessToken: 'jwt', refreshToken: 'rt', expiresIn: 900 };
      authService.handleCallback.mockResolvedValue(tokenPair);
      const reply = makeFastifyReply();

      await controller.callback('auth-code', 'state-value', reply as any);

      expect(authService.handleCallback).toHaveBeenCalledWith('auth-code', 'state-value');
      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(tokenPair);
    });

    it('sends 400 error envelope when code is missing', async () => {
      const reply = makeFastifyReply();

      await controller.callback('', 'state-value', reply as any);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        error: { code: 'INVALID_CALLBACK', message: 'Missing or invalid authorization code' },
      });
      expect(authService.handleCallback).not.toHaveBeenCalled();
    });

    it('sends 400 error envelope when state is missing', async () => {
      const reply = makeFastifyReply();

      await controller.callback('some-code', '', reply as any);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        error: { code: 'INVALID_CALLBACK', message: 'Missing or invalid authorization code' },
      });
      expect(authService.handleCallback).not.toHaveBeenCalled();
    });

    it('sends 400 error envelope when both code and state are missing', async () => {
      const reply = makeFastifyReply();

      await controller.callback(undefined as any, undefined as any, reply as any);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(authService.handleCallback).not.toHaveBeenCalled();
    });
  });
});
