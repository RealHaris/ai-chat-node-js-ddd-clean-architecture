import { Job, Worker } from 'bullmq';
import { eq, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';

import Config from '~/configs';
import { db } from '~/shared/infra/db/config/config';
import { subscriptions } from '~/shared/infra/db/schemas/subscriptions';
import { users } from '~/shared/infra/db/schemas/users';
import { Subscription } from '~/shared/infra/db/types';
import { QUEUE_NAMES, subscriptionExpiryQueue } from '~/shared/infra/queue';
import { useLogger } from '~/shared/packages/logger/logger';
import { SubscriptionReadRepository } from '~/modules/subscription/infra/persistence/repository/read';

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

// Handle subscription expiry (auto-renew OFF or payment failed)
export async function handleSubscriptionExpiry(
  userId: string,
  subscriptionId: string,
  reason: string,
  subscriptionReadRepository: SubscriptionReadRepository
): Promise<void> {
  logger.log(`Handling expiry for subscription ${subscriptionId}`, {
    reason,
    userId,
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

  // Get user to check current quota state
  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  const user = userResult[0];
  if (!user) {
    logger.error(`User ${userId} not found during expiry handling`);
    return;
  }

  // Calculate quota to remove
  // If this was the latest bundle, we remove its specific remaining quota
  // If not, we assume 0 (or could assume maxMessages if we tracked it, but we don't)
  let quotaToRemove = 0;
  if (user.latestBundleId === subscriptionId) {
    quotaToRemove = user.latestBundleRemainingQuota || 0;
  }

  // Update total remaining messages
  // Ensure we don't go below 0
  const newTotal = Math.max(0, user.totalRemainingMessages - quotaToRemove);

  // Find next active subscription to fallback to
  // We exclude the one we just expired
  const activeSubscriptions = await subscriptionReadRepository.findActiveByUserId(userId);
  const nextLatest = activeSubscriptions.find(sub => sub.id !== subscriptionId);

  if (nextLatest) {
    // Fallback to next active bundle
    logger.log(`Falling back to subscription ${nextLatest.id} for user ${userId}`);
    
    await db
      .update(users)
      .set({
        totalRemainingMessages: newTotal,
        latestBundleId: nextLatest.id,
        // We set latest remaining to total because total now represents the sum of all remaining bundles
        // and we treat the "latest" as the primary bucket for the aggregate
        latestBundleRemainingQuota: newTotal, 
        latestBundleName: nextLatest.bundleName,
        latestBundleMaxMessages: nextLatest.bundleMaxMessages,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  } else {
    // No other active bundles - shift to free tier
    logger.log(`No active subscriptions left for user ${userId}, shifting to free tier`);
    
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
  }
}

// Process renewal for a subscription with auto-renewal enabled
export async function processRenewal(
  subscription: Subscription,
  subscriptionReadRepository: SubscriptionReadRepository
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

    // Handle expiry on payment failure
    await handleSubscriptionExpiry(
      userId, 
      id, 
      `Payment failed: ${paymentResult.error}`,
      subscriptionReadRepository
    );

    return {
      success: false,
      message: `Payment failed for subscription ${id}: ${paymentResult.error}. Subscription expired.`,
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

  // Get current user state
  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  const user = userResult[0];
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  // Calculate quota adjustments
  // 1. Subtract old bundle's remaining quota (if it was the latest)
  let quotaToRemove = 0;
  if (user.latestBundleId === id) {
    quotaToRemove = user.latestBundleRemainingQuota || 0;
  }
  
  // 2. Add new bundle's quota
  const isUnlimited = bundleMaxMessages === -1;
  const currentTotal = user.totalRemainingMessages;
  
  // If unlimited, we set to a high number or sentinel. If not, we calculate.
  // Logic: (Current Total - Old Remaining) + New Quota
  const adjustedTotal = Math.max(0, currentTotal - quotaToRemove);
  const newTotal = isUnlimited ? 999999999 : adjustedTotal + bundleMaxMessages;

  await db
    .update(users)
    .set({
      isFreeTier: false,
      totalRemainingMessages: newTotal,
      latestBundleId: id, // Renewed bundle becomes/stays latest
      latestBundleRemainingQuota: bundleMaxMessages, // Reset to full quota
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
  // Instantiate repository manually since we are outside DI container scope in worker factory
  // In a real app, we might want to setup DI container for worker too
  const subscriptionReadRepository = new SubscriptionReadRepository();

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
        // Auto-renewal is OFF - expire and fallback
        logger.log(
          `Auto-renewal disabled for subscription ${subscriptionId}, expiring...`
        );
        await handleSubscriptionExpiry(
          userId,
          subscriptionId,
          'Auto-renewal disabled by user',
          subscriptionReadRepository
        );
        return {
          success: true,
          message: `Subscription ${subscriptionId} expired. Handled fallback logic.`,
        };
      }

      // Auto-renewal is ON - attempt payment and renewal
      const result = await processRenewal(subscription, subscriptionReadRepository);

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
        password:
          Config.REDIS_USE_PASSWORD === 'yes'
            ? Config.REDIS_PASSWORD
            : undefined,
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
