import { Job, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';

import Config from '~/configs';
import { db } from '~/shared/infra/db/config/config';
import { subscriptions } from '~/shared/infra/db/schemas/subscriptions';
import { users } from '~/shared/infra/db/schemas/users';
import { Subscription } from '~/shared/infra/db/types';
import { useLogger } from '~/shared/packages/logger/logger';
import { QUEUE_NAMES } from '~/shared/infra/queue';

const logger = useLogger('SubscriptionRenewalWorker');

export interface SubscriptionRenewalJobData {
  subscriptionId: string;
  userId: string;
  bundleName: string;
  bundleMaxMessages: number;
  bundlePrice: string;
  billingCycle: 'monthly' | 'yearly';
}

// Simulate payment with 5% failure rate
function simulatePayment(): { success: boolean; error?: string } {
  const randomValue = Math.random();

  if (randomValue < 0.05) {
    // 5% failure rate
    return {
      success: false,
      error: 'Payment declined: Insufficient funds',
    };
  }

  return { success: true };
}

// Calculate new dates based on billing cycle
function calculateNewDates(billingCycle: 'monthly' | 'yearly'): {
  endDate: Date;
  renewalDate: Date;
} {
  const now = new Date();
  const endDate = new Date(now);
  const renewalDate = new Date(now);

  if (billingCycle === 'monthly') {
    endDate.setMonth(endDate.getMonth() + 1);
    renewalDate.setMonth(renewalDate.getMonth() + 1);
  } else {
    endDate.setFullYear(endDate.getFullYear() + 1);
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  }

  return { endDate, renewalDate };
}

// Process renewal for a single subscription
async function processRenewal(
  subscription: Subscription
): Promise<{ success: boolean; message: string }> {
  const { id, userId, bundleName, bundleMaxMessages, billingCycle } =
    subscription;

  logger.log(`Processing renewal for subscription ${id}`, {
    userId,
    bundleName,
    billingCycle,
  });

  // Simulate payment
  const paymentResult = simulatePayment();

  if (!paymentResult.success) {
    logger.warn(`Payment failed for subscription ${id}`, {
      error: paymentResult.error,
    });

    // Deactivate subscription on payment failure
    await db
      .update(subscriptions)
      .set({
        status: false,
        autoRenewal: false,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, id));

    return {
      success: false,
      message: `Payment failed for subscription ${id}: ${paymentResult.error}`,
    };
  }

  // Calculate new dates
  const { endDate, renewalDate } = calculateNewDates(
    billingCycle as 'monthly' | 'yearly'
  );

  // Update subscription with new dates
  await db
    .update(subscriptions)
    .set({
      endDate,
      renewalDate,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, id));

  // Add quota to user
  const isUnlimited = bundleMaxMessages === -1;

  // Get current user quota
  const userResult = await db
    .select({ totalRemainingMessages: users.totalRemainingMessages })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const currentTotal = userResult[0]?.totalRemainingMessages || 0;
  const newTotal = isUnlimited ? 999999999 : currentTotal + bundleMaxMessages;

  await db
    .update(users)
    .set({
      totalRemainingMessages: newTotal,
      latestBundleId: id,
      latestBundleRemainingQuota: bundleMaxMessages,
      latestBundleName: bundleName,
      latestBundleMaxMessages: bundleMaxMessages,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  logger.log(`Successfully renewed subscription ${id}`, {
    newEndDate: endDate,
    newRenewalDate: renewalDate,
    quotaAdded: bundleMaxMessages,
  });

  return {
    success: true,
    message: `Successfully renewed subscription ${id}`,
  };
}

// Create the worker
export function createSubscriptionRenewalWorker(): Worker {
  const worker = new Worker<SubscriptionRenewalJobData>(
    QUEUE_NAMES.SUBSCRIPTION_RENEWAL,
    async (job: Job<SubscriptionRenewalJobData>) => {
      const { subscriptionId } = job.data;

      logger.log(`Processing subscription renewal job`, {
        jobId: job.id,
        subscriptionId,
      });

      // Fetch the subscription from database
      const subscriptionResult = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId))
        .limit(1);

      const subscription = subscriptionResult[0];

      if (!subscription) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      // Check if subscription is still eligible for renewal
      if (!subscription.status || !subscription.autoRenewal) {
        logger.log(
          `Subscription ${subscriptionId} is not eligible for renewal`,
          {
            status: subscription.status,
            autoRenewal: subscription.autoRenewal,
          }
        );
        return { skipped: true, reason: 'Not eligible for renewal' };
      }

      // Process the renewal
      const result = await processRenewal(subscription);

      if (!result.success) {
        throw new Error(result.message);
      }

      return result;
    },
    {
      connection: {
        host: Config.REDIS_HOST,
        port: Config.REDIS_PORT,
        password: Config.REDIS_PASSWORD || undefined,
      },
      concurrency: 5, // Process up to 5 jobs concurrently
    }
  );

  // Event handlers
  worker.on('completed', job => {
    logger.log(`Subscription renewal job completed`, {
      jobId: job.id,
      subscriptionId: job.data.subscriptionId,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error(`Subscription renewal job failed`, {
      jobId: job?.id,
      subscriptionId: job?.data.subscriptionId,
      error: err.message,
    });
  });

  worker.on('error', err => {
    logger.error(`Subscription renewal worker error`, { error: err.message });
  });

  return worker;
}

export default createSubscriptionRenewalWorker;
