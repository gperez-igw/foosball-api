import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';

interface ErrorBody {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorBody: ErrorBody = { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null) {
        const r = response as Record<string, unknown>;
        errorBody = {
          code: (r.code as string) ?? 'HTTP_ERROR',
          message: (r.message as string) ?? exception.message,
          details: r.details as Record<string, unknown> | undefined,
        };
      } else if (typeof response === 'string') {
        errorBody = { code: 'HTTP_ERROR', message: response };
      }
    }

    reply.status(status).send({ error: errorBody });
  }
}
