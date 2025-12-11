import { Queue, QueueOptions } from 'bullmq';

import Config from '~/configs';

// Queue connection options
const connectionOptions: QueueOptions['connection'] = {
  host: Config.REDIS_HOST,
  port: Config.REDIS_PORT,
  password: Config.REDIS_PASSWORD || undefined,
};

// Queue names
export const QUEUE_NAMES = {
  SUBSCRIPTION_RENEWAL: 'subscription-renewal',
  FREE_TIER_RESET: 'free-tier-reset',
} as const;

// Subscription renewal queue
export const subscriptionRenewalQueue = new Queue(
  QUEUE_NAMES.SUBSCRIPTION_RENEWAL,
  {
    connection: connectionOptions,
    defaultJobOptions: {
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 500, // Keep last 500 failed jobs
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000, // 5 seconds initial delay
      },
    },
  }
);

// Free tier reset queue
export const freeTierResetQueue = new Queue(QUEUE_NAMES.FREE_TIER_RESET, {
  connection: connectionOptions,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

// Export all queues
export const queues = {
  subscriptionRenewalQueue,
  freeTierResetQueue,
};

export default queues;
