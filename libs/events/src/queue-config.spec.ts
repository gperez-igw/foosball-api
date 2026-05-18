describe('queue-config defaultJobOptions', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('defaults MAX_RETRIES to 3 when BULLMQ_MAX_RETRIES is not set', async () => {
    delete process.env['BULLMQ_MAX_RETRIES'];
    const { defaultJobOptions } = await import('./queue-config');
    expect(defaultJobOptions.attempts).toBe(3);
  });

  it('uses BULLMQ_MAX_RETRIES env var when set', async () => {
    process.env['BULLMQ_MAX_RETRIES'] = '7';
    const { defaultJobOptions } = await import('./queue-config');
    expect(defaultJobOptions.attempts).toBe(7);
  });

  it('uses exponential backoff with 1000ms delay', async () => {
    delete process.env['BULLMQ_MAX_RETRIES'];
    const { defaultJobOptions } = await import('./queue-config');
    expect(defaultJobOptions.backoff).toEqual({ type: 'exponential', delay: 1000 });
  });
});
