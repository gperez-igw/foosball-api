import type { DefaultJobOptions } from 'bullmq';

const MAX_RETRIES = parseInt(process.env['BULLMQ_MAX_RETRIES'] ?? '3', 10);

export const defaultJobOptions: DefaultJobOptions = {
  attempts: MAX_RETRIES,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: { age: 86400 },
  removeOnFail: false,
};
