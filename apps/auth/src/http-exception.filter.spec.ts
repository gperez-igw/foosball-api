import { HttpException, HttpStatus, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import type { FastifyReply } from 'fastify';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeReply(): jest.Mocked<Pick<FastifyReply, 'status' | 'send'>> & { status: jest.Mock; send: jest.Mock } {
  const reply: any = { status: jest.fn(), send: jest.fn() };
  reply.status.mockReturnValue(reply);
  return reply;
}

function makeHost(reply: FastifyReply): ArgumentsHost {
  return {
    switchToHttp: jest.fn().mockReturnValue({
      getResponse: jest.fn().mockReturnValue(reply),
    }),
  } as unknown as ArgumentsHost;
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  // ── structured response with 'code' field ──────────────────────────────────

  describe('when exception response is an object with a code field', () => {
    it('passes through code and message from the structured response', () => {
      const reply = makeReply();
      const host = makeHost(reply as any);
      const exception = new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'refreshToken is required',
      });

      filter.catch(exception, host);

      expect(reply.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(reply.send).toHaveBeenCalledWith({
        error: { code: 'VALIDATION_ERROR', message: 'refreshToken is required', details: undefined },
      });
    });

    it('passes through optional details field when present', () => {
      const reply = makeReply();
      const host = makeHost(reply as any);
      const exception = new ConflictException({
        code: 'MATCH_ALREADY_CONFIRMED',
        message: 'Match is already confirmed',
        details: { matchId: 42 },
      });

      filter.catch(exception, host);

      expect(reply.send).toHaveBeenCalledWith({
        error: {
          code: 'MATCH_ALREADY_CONFIRMED',
          message: 'Match is already confirmed',
          details: { matchId: 42 },
        },
      });
    });

    it('maps 404 NotFoundException to correct HTTP status', () => {
      const reply = makeReply();
      const host = makeHost(reply as any);
      const exception = new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User 999 not found',
      });

      filter.catch(exception, host);

      expect(reply.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(reply.send).toHaveBeenCalledWith({
        error: { code: 'USER_NOT_FOUND', message: 'User 999 not found', details: undefined },
      });
    });
  });

  // ── string response ────────────────────────────────────────────────────────

  describe('when exception response is a plain string', () => {
    it('wraps the string in an ERROR envelope', () => {
      const reply = makeReply();
      const host = makeHost(reply as any);
      // HttpException with a string message
      const exception = new HttpException('Something went wrong', HttpStatus.INTERNAL_SERVER_ERROR);

      filter.catch(exception, host);

      expect(reply.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(reply.send).toHaveBeenCalledWith({
        error: { code: 'ERROR', message: 'Something went wrong' },
      });
    });
  });

  // ── default NestJS error shape (no code field) ─────────────────────────────

  describe('when exception response is a NestJS default object (no code)', () => {
    it('derives code from the error field and joins array messages', () => {
      const reply = makeReply();
      const host = makeHost(reply as any);
      // NestJS ValidationPipe produces { message: string[], error: 'Bad Request', statusCode: 400 }
      const exception = new HttpException(
        { message: ['field must be a string', 'field must not be empty'], error: 'Bad Request', statusCode: 400 },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, host);

      expect(reply.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(reply.send).toHaveBeenCalledWith({
        error: {
          code: 'BAD_REQUEST',
          message: 'field must be a string; field must not be empty',
        },
      });
    });

    it('uses message string directly when not an array', () => {
      const reply = makeReply();
      const host = makeHost(reply as any);
      const exception = new HttpException(
        { message: 'Forbidden resource', error: 'Forbidden', statusCode: 403 },
        HttpStatus.FORBIDDEN,
      );

      filter.catch(exception, host);

      expect(reply.send).toHaveBeenCalledWith({
        error: { code: 'FORBIDDEN', message: 'Forbidden resource' },
      });
    });

    it('falls back to "An error occurred" when message is absent', () => {
      const reply = makeReply();
      const host = makeHost(reply as any);
      const exception = new HttpException({ error: 'Unknown' }, HttpStatus.INTERNAL_SERVER_ERROR);

      filter.catch(exception, host);

      expect(reply.send).toHaveBeenCalledWith({
        error: { code: 'UNKNOWN', message: 'An error occurred' },
      });
    });

    it('falls back to ERROR code when error field is absent', () => {
      const reply = makeReply();
      const host = makeHost(reply as any);
      const exception = new HttpException({ message: 'Something happened' }, HttpStatus.INTERNAL_SERVER_ERROR);

      filter.catch(exception, host);

      expect(reply.send).toHaveBeenCalledWith({
        error: { code: 'ERROR', message: 'Something happened' },
      });
    });
  });

  // ── status code propagation ────────────────────────────────────────────────

  describe('HTTP status code propagation', () => {
    it.each([
      [HttpStatus.BAD_REQUEST, new BadRequestException({ code: 'ERR', message: 'bad' })],
      [HttpStatus.NOT_FOUND, new NotFoundException({ code: 'ERR', message: 'not found' })],
      [HttpStatus.CONFLICT, new ConflictException({ code: 'ERR', message: 'conflict' })],
    ])('sets reply status to %i', (expectedStatus, exception) => {
      const reply = makeReply();
      const host = makeHost(reply as any);

      filter.catch(exception, host);

      expect(reply.status).toHaveBeenCalledWith(expectedStatus);
    });
  });
});
