import 'reflect-metadata';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

import { db } from '~/shared/infra/db/config/config';
import { subscriptions } from '~/shared/infra/db/schemas/subscriptions';
import { users } from '~/shared/infra/db/schemas/users';
import { bundleTiers } from '~/shared/infra/db/schemas/bundle_tiers';
import { handleSubscriptionExpiry } from '~/shared/infra/queue/workers/subscription_expiry.worker';
import { SubscriptionReadRepository } from '~/modules/subscription/infra/persistence/repository/read';

async function runMultipleSubscriptionE2ETest() {
  console.log('🚀 Starting Multiple Subscription E2E Test...');

  const userId = uuidv4();
  const bundleTierIdA = uuidv4();
  const bundleTierIdB = uuidv4();
  const subIdA = uuidv4();
  const subIdB = uuidv4();
  const repo = new SubscriptionReadRepository();

  try {
    // 1. Setup Bundle Tiers
    await db.insert(bundleTiers).values([
      {
        id: bundleTierIdA,
        name: 'Bundle A',
        maxMessages: 10,
        priceMonthly: '10.00',
        priceYearly: '100.00',
      },
      {
        id: bundleTierIdB,
        name: 'Bundle B',
        maxMessages: 20,
        priceMonthly: '20.00',
        priceYearly: '200.00',
      }
    ]);

    // 2. Setup User
    await db.insert(users).values({
      id: userId,
      email: `multi-sub-${userId}@example.com`,
      password: 'hashed_password',
      role: 'user',
      totalRemainingMessages: 3,
      isFreeTier: true,
      latestBundleId: null,
      latestBundleRemainingQuota: 3,
    });

    // 3. Subscribe to Bundle A
    console.log('Subscribing to Bundle A...');
    await db.insert(subscriptions).values({
      id: subIdA,
      userId,
      bundleTierId: bundleTierIdA,
      bundleName: 'Bundle A',
      bundleMaxMessages: 10,
      bundlePrice: '10.00',
      billingCycle: 'monthly',
      autoRenewal: true,
      status: true,
      startDate: new Date(),
      endDate: new Date(Date.now() + 10000000), // Active
      renewalDate: new Date(Date.now() + 10000000),
    });

    // Update user for Bundle A
    // Free tier -> Override
    await db.update(users).set({
      isFreeTier: false,
      totalRemainingMessages: 10,
      latestBundleId: subIdA,
      latestBundleRemainingQuota: 10,
    }).where(eq(users.id, userId));

    // 4. Subscribe to Bundle B
    console.log('Subscribing to Bundle B...');
    await db.insert(subscriptions).values({
      id: subIdB,
      userId,
      bundleTierId: bundleTierIdB,
      bundleName: 'Bundle B',
      bundleMaxMessages: 20,
      bundlePrice: '20.00',
      billingCycle: 'monthly',
      autoRenewal: false, // Will expire
      status: true,
      startDate: new Date(),
      endDate: new Date(), // Expired immediately
      renewalDate: new Date(),
    });

    // Update user for Bundle B
    // Not free tier -> Add
    await db.update(users).set({
      totalRemainingMessages: 30, // 10 + 20
      latestBundleId: subIdB,
      latestBundleRemainingQuota: 20,
    }).where(eq(users.id, userId));

    // 5. Run Expiry Logic for Bundle B
    console.log('Running expiry logic for Bundle B...');
    await handleSubscriptionExpiry(
      userId,
      subIdB,
      'Test Expiry',
      repo
    );

    // 6. Verify Fallback to Bundle A
    const [updatedUser] = await db.select().from(users).where(eq(users.id, userId));

    if (!updatedUser) throw new Error('User not found');

    // Logic:
    // Total was 30.
    // Expired Bundle B had 20 remaining (latestBundleRemainingQuota).
    // New Total = 30 - 20 = 10.
    // Fallback to Bundle A.
    // Latest Bundle = Bundle A.
    // Latest Remaining Quota = New Total = 10.

    if (updatedUser.latestBundleId !== subIdA) {
      throw new Error(`Expected latestBundleId to be ${subIdA} (Bundle A), got ${updatedUser.latestBundleId}`);
    }

    if (updatedUser.totalRemainingMessages !== 10) {
      throw new Error(`Expected totalRemainingMessages to be 10, got ${updatedUser.totalRemainingMessages}`);
    }

    if (updatedUser.isFreeTier !== false) {
      throw new Error(`Expected isFreeTier to be false, got ${updatedUser.isFreeTier}`);
    }

    console.log('✅ PASSED: Multiple subscriptions handled correctly with fallback.');

  } catch (error) {
    console.error('❌ FAILED: Multiple Subscription E2E test failed', error);
    process.exit(1);
  } finally {
    // Cleanup
    await db.delete(subscriptions).where(eq(subscriptions.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
    await db.delete(bundleTiers).where(eq(bundleTiers.id, bundleTierIdA));
    await db.delete(bundleTiers).where(eq(bundleTiers.id, bundleTierIdB));
    console.log('Cleanup complete.');
    process.exit(0);
  }
}

runMultipleSubscriptionE2ETest();
