import { Queue, QueueOptions } from 'bullmq';

import Config from '~/configs';

// Queue connection options
const connectionOptions: QueueOptions['connection'] = {
  host: Config.REDIS_HOST,
  port: Config.REDIS_PORT,
  password:
    Config.REDIS_USE_PASSWORD === 'yes' ? Config.REDIS_PASSWORD : undefined,
};

// Queue names
export const QUEUE_NAMES = {
  SUBSCRIPTION_EXPIRY: 'subscription-expiry',
} as const;

// Subscription expiry queue - handles subscription expiry processing
// When a subscription expires:
// - If autoRenewal=true: attempt payment renewal
// - If autoRenewal=false or payment fails: shift user to free tier
export const subscriptionExpiryQueue = new Queue(
  QUEUE_NAMES.SUBSCRIPTION_EXPIRY,
  {
    connection: connectionOptions,
    defaultJobOptions: {
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 500, // Keep last 500 failed jobs
      // attempts: 3,
      // backoff: {
      //   type: 'exponential',
      //   delay: 5000, // 5 seconds initial delay
      // },
    },
  }
);

// Export all queues
export const queues = {
  subscriptionExpiryQueue,
};

export default queues;
