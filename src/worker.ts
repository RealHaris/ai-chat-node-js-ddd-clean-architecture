import 'reflect-metadata';

import { useLogger } from '~/shared/packages/logger/logger';
import { createSubscriptionExpiryWorker } from '~/shared/infra/queue/workers/subscription_expiry.worker';
import { startFreeTierResetJob } from '~/shared/infra/cron/jobs/free_tier_reset.job';

const logger = useLogger('WorkerProcess');

async function bootstrap() {
  logger.log('Starting worker process...');

  // Start BullMQ workers
  logger.log('Starting subscription expiry worker...');
  const subscriptionExpiryWorker = createSubscriptionExpiryWorker();

  // Start cron jobs
  logger.log('Starting cron jobs...');
  const freeTierResetTask = startFreeTierResetJob();

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}. Shutting down gracefully...`);

    // Stop cron jobs
    freeTierResetTask.stop();
    logger.log('Cron jobs stopped');

    // Close BullMQ workers
    await subscriptionExpiryWorker.close();
    logger.log('BullMQ workers closed');

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  logger.log('Worker process started successfully');
  logger.log('Workers: [SubscriptionExpiryWorker]');
  logger.log('Cron Jobs: [FreeTierResetJob - 1st of each month at 00:00 UTC]');
}

void bootstrap();
