import { Job, Worker } from 'bullmq';
import { eq, sql } from 'drizzle-orm';

import Config from '~/configs';
import { db } from '~/shared/infra/db/config/config';
import { subscriptions } from '~/shared/infra/db/schemas/subscriptions';
import { users } from '~/shared/infra/db/schemas/users';
import { Subscription } from '~/shared/infra/db/types';
import { QUEUE_NAMES, subscriptionExpiryQueue } from '~/shared/infra/queue';
import { useLogger } from '~/shared/packages/logger/logger';

const logger = useLogger('SubscriptionExpiryWorker');

const FREE_TIER_MONTHLY_MESSAGES = 3;

export interface SubscriptionExpiryJobData {
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

// Calculate new end date based on billing cycle
function calculateNextEndDate(billingCycle: 'monthly' | 'yearly'): Date {
  const now = new Date();
  const endDate = new Date(now);

  if (billingCycle === 'monthly') {
    endDate.setMonth(endDate.getMonth() + 1);
  } else {
    endDate.setFullYear(endDate.getFullYear() + 1);
  }

  return endDate;
}

// Calculate delay in milliseconds from now until the end date
function calculateDelayMs(endDate: Date): number {
  const now = new Date();
  const delay = endDate.getTime() - now.getTime();
  return Math.max(delay, 0); // Ensure non-negative delay
}

// Shift user to free tier
async function shiftToFreeTier(
  userId: string,
  subscriptionId: string,
  reason: string
): Promise<void> {
  logger.log(`Shifting user ${userId} to free tier`, {
    reason,
    subscriptionId,
  });

  // Deactivate the subscription
  await db
    .update(subscriptions)
    .set({
      status: false,
      autoRenewal: false,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscriptionId));

  // Update user to free tier
  await db
    .update(users)
    .set({
      isFreeTier: true,
      totalRemainingMessages: FREE_TIER_MONTHLY_MESSAGES,
      latestBundleId: null,
      latestBundleRemainingQuota: FREE_TIER_MONTHLY_MESSAGES,
      latestBundleName: 'Free Tier',
      latestBundleMaxMessages: FREE_TIER_MONTHLY_MESSAGES,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  logger.log(`User ${userId} successfully shifted to free tier`);
}

// Process renewal for a subscription with auto-renewal enabled
async function processRenewal(
  subscription: Subscription
): Promise<{ success: boolean; message: string; newEndDate?: Date }> {
  const {
    id,
    userId,
    bundleName,
    bundleMaxMessages,
    bundlePrice,
    billingCycle,
  } = subscription;

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

    // Shift user to free tier on payment failure
    await shiftToFreeTier(userId, id, `Payment failed: ${paymentResult.error}`);

    return {
      success: false,
      message: `Payment failed for subscription ${id}: ${paymentResult.error}. User shifted to free tier.`,
    };
  }

  // Calculate new end date
  const newEndDate = calculateNextEndDate(billingCycle as 'monthly' | 'yearly');

  // Update subscription with new dates
  await db
    .update(subscriptions)
    .set({
      endDate: newEndDate,
      renewalDate: newEndDate,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, id));

  // Add quota to user and update totalSpent
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
      isFreeTier: false,
      totalRemainingMessages: newTotal,
      latestBundleId: id,
      latestBundleRemainingQuota: bundleMaxMessages,
      latestBundleName: bundleName,
      latestBundleMaxMessages: bundleMaxMessages,
      totalSpent: sql`${users.totalSpent} + ${bundlePrice}::decimal`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  logger.log(`Successfully renewed subscription ${id}`, {
    newEndDate,
    quotaAdded: bundleMaxMessages,
    priceCharged: bundlePrice,
  });

  return {
    success: true,
    message: `Successfully renewed subscription ${id}`,
    newEndDate,
  };
}

// Schedule the next expiry job
async function scheduleNextExpiryJob(
  subscription: Subscription,
  endDate: Date
): Promise<void> {
  const delay = calculateDelayMs(endDate);

  const jobData: SubscriptionExpiryJobData = {
    subscriptionId: subscription.id,
    userId: subscription.userId,
    bundleName: subscription.bundleName,
    bundleMaxMessages: subscription.bundleMaxMessages,
    bundlePrice: subscription.bundlePrice,
    billingCycle: subscription.billingCycle as 'monthly' | 'yearly',
  };

  await subscriptionExpiryQueue.add(`expiry-${subscription.id}`, jobData, {
    delay,
    jobId: `expiry-${subscription.id}-${endDate.getTime()}`,
  });

  logger.log(`Scheduled next expiry job for subscription ${subscription.id}`, {
    endDate,
    delayMs: delay,
  });
}

// Create the worker
export function createSubscriptionExpiryWorker(): Worker {
  const worker = new Worker<SubscriptionExpiryJobData>(
    QUEUE_NAMES.SUBSCRIPTION_EXPIRY,
    async (job: Job<SubscriptionExpiryJobData>) => {
      const { subscriptionId, userId } = job.data;

      logger.log(`Processing subscription expiry job`, {
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
        logger.warn(`Subscription ${subscriptionId} not found, skipping`);
        return { skipped: true, reason: 'Subscription not found' };
      }

      // Check if subscription is already inactive
      if (!subscription.status) {
        logger.log(
          `Subscription ${subscriptionId} is already inactive, skipping`
        );
        return { skipped: true, reason: 'Subscription already inactive' };
      }

      // Check autoRenewal flag
      if (!subscription.autoRenewal) {
        // Auto-renewal is OFF - shift to free tier
        logger.log(
          `Auto-renewal disabled for subscription ${subscriptionId}, shifting to free tier`
        );
        await shiftToFreeTier(
          userId,
          subscriptionId,
          'Auto-renewal disabled by user'
        );
        return {
          success: true,
          message: `Subscription ${subscriptionId} expired. User shifted to free tier (auto-renewal disabled).`,
        };
      }

      // Auto-renewal is ON - attempt payment and renewal
      const result = await processRenewal(subscription);

      if (result.success && result.newEndDate) {
        // Schedule the next expiry job
        await scheduleNextExpiryJob(subscription, result.newEndDate);
      }

      return result;
    },
    {
      connection: {
        host: Config.REDIS_HOST,
        port: Config.REDIS_PORT,
        password: Config.REDIS_USE_PASSWORD === 'yes' ? Config.REDIS_PASSWORD : undefined,
      },
      concurrency: 5, // Process up to 5 jobs concurrently
    }
  );

  // Event handlers
  worker.on('completed', job => {
    logger.log(`Subscription expiry job completed`, {
      jobId: job.id,
      subscriptionId: job.data.subscriptionId,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error(`Subscription expiry job failed`, {
      jobId: job?.id,
      subscriptionId: job?.data.subscriptionId,
      error: err.message,
    });
  });

  worker.on('error', err => {
    logger.error(`Subscription expiry worker error`, { error: err.message });
  });

  return worker;
}

export default createSubscriptionExpiryWorker;
