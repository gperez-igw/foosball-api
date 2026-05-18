import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';

function makeHost(reply: { status: jest.Mock; header?: jest.Mock }) {
  const statusChain = { send: jest.fn() };
  reply.status = jest.fn().mockReturnValue(statusChain);
  return {
    switchToHttp: () => ({
      getResponse: () => reply as unknown as import('fastify').FastifyReply,
    }),
    _send: statusChain.send,
    _reply: reply,
  };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  it('maps a non-HttpException to 500 INTERNAL_ERROR envelope', () => {
    const reply = {} as { status: jest.Mock };
    const host = makeHost(reply);
    const genericError = new Error('boom');

    filter.catch(genericError, host as unknown as ArgumentsHost);

    expect(reply.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(host._send).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  });

  it('maps an HttpException with object response (code+message+details)', () => {
    const reply = {} as { status: jest.Mock };
    const host = makeHost(reply);
    const ex = new HttpException(
      { code: 'NOT_FOUND', message: 'Resource not found', details: { id: 42 } },
      HttpStatus.NOT_FOUND,
    );

    filter.catch(ex, host as unknown as ArgumentsHost);

    expect(reply.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(host._send).toHaveBeenCalledWith({
      error: { code: 'NOT_FOUND', message: 'Resource not found', details: { id: 42 } },
    });
  });

  it('maps an HttpException with object response missing code to HTTP_ERROR', () => {
    const reply = {} as { status: jest.Mock };
    const host = makeHost(reply);
    const ex = new HttpException({ message: 'Conflict' }, HttpStatus.CONFLICT);

    filter.catch(ex, host as unknown as ArgumentsHost);

    expect(reply.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    const sent = host._send.mock.calls[0][0] as { error: Record<string, unknown> };
    expect(sent.error.code).toBe('HTTP_ERROR');
    expect(sent.error.message).toBe('Conflict');
  });

  it('maps an HttpException with string response to HTTP_ERROR', () => {
    const reply = {} as { status: jest.Mock };
    const host = makeHost(reply);
    const ex = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    filter.catch(ex, host as unknown as ArgumentsHost);

    expect(reply.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(host._send).toHaveBeenCalledWith({
      error: { code: 'HTTP_ERROR', message: 'Forbidden' },
    });
  });

  it('maps a 401 HttpException with object response correctly', () => {
    const reply = {} as { status: jest.Mock };
    const host = makeHost(reply);
    const ex = new HttpException(
      { code: 'UNAUTHORIZED', message: 'Token expired' },
      HttpStatus.UNAUTHORIZED,
    );

    filter.catch(ex, host as unknown as ArgumentsHost);

    expect(reply.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    const sent = host._send.mock.calls[0][0] as { error: Record<string, unknown> };
    expect(sent.error.code).toBe('UNAUTHORIZED');
    expect(sent.error.message).toBe('Token expired');
  });
});
