import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const status = exception.getStatus();
    const response = exception.getResponse();

    let errorBody: { code: string; message: string; details?: Record<string, unknown> };

    if (typeof response === 'object' && response !== null && 'code' in response) {
      const r = response as { code: string; message: string; details?: Record<string, unknown> };
      errorBody = { code: r.code, message: r.message, details: r.details };
    } else if (typeof response === 'string') {
      errorBody = { code: 'ERROR', message: response };
    } else {
      const r = response as { message?: string | string[]; error?: string };
      const message = Array.isArray(r.message) ? r.message.join('; ') : (r.message ?? 'An error occurred');
      errorBody = { code: r.error?.toUpperCase().replace(/\s+/g, '_') ?? 'ERROR', message };
    }

    reply.status(status).send({ error: errorBody });
  }
}
