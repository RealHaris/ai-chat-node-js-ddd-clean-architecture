import { eq } from 'drizzle-orm';
import 'reflect-metadata';
import { v4 as uuidv4 } from 'uuid';

import { SubscriptionReadRepository } from '~/modules/subscription/infra/persistence/repository/read';
import { db } from '~/shared/infra/db/config/config';
import { bundleTiers } from '~/shared/infra/db/schemas/bundle_tiers';
import { subscriptions } from '~/shared/infra/db/schemas/subscriptions';
import { users } from '~/shared/infra/db/schemas/users';
import { handleSubscriptionExpiry } from '~/shared/infra/queue/workers/subscription_expiry.worker';

async function runSingleSubscriptionE2ETest() {
  console.log('🚀 Starting Single Subscription E2E Test...');

  const userId = uuidv4();
  const bundleTierId = uuidv4();
  const subscriptionId = uuidv4();
  const repo = new SubscriptionReadRepository();

  try {
    // 1. Setup Bundle Tier
    await db.insert(bundleTiers).values({
      id: bundleTierId,
      name: 'Single Sub Test Bundle',
      maxMessages: 10,
      priceMonthly: '10.00',
      priceYearly: '100.00',
    });

    // 2. Setup User (Free Tier initially)
    await db.insert(users).values({
      id: userId,
      email: `single-sub-${userId}@example.com`,
      password: 'hashed_password',
      role: 'user',
      totalRemainingMessages: 3,
      isFreeTier: true,
      latestBundleId: null,
      latestBundleRemainingQuota: 3,
    });

    // 3. Subscribe (Simulate subscription creation)
    console.log('Simulating subscription...');
    await db.insert(subscriptions).values({
      id: subscriptionId,
      userId,
      bundleTierId,
      bundleName: 'Single Sub Test Bundle',
      bundleMaxMessages: 10,
      bundlePrice: '10.00',
      billingCycle: 'monthly',
      autoRenewal: false, // OFF for this test to trigger expiry
      status: true,
      startDate: new Date(),
      endDate: new Date(), // Expired immediately
      renewalDate: new Date(),
    });

    // Update user to reflect subscription
    // Requirement: "if is_free_tier : true means he's on free tier, and then override the total_remaining_messages with bundle count"
    await db.update(users).set({
      isFreeTier: false,
      totalRemainingMessages: 10,
      latestBundleId: subscriptionId,
      latestBundleRemainingQuota: 10,
    }).where(eq(users.id, userId));

    // 4. Run Expiry Logic
    console.log('Running expiry logic...');
    await handleSubscriptionExpiry(
      userId,
      subscriptionId,
      'Test Expiry',
      repo
    );

    // 5. Verify Fallback to Free Tier
    const [updatedUser] = await db.select().from(users).where(eq(users.id, userId));

    if (!updatedUser) throw new Error('User not found');

    if (updatedUser.isFreeTier !== true) {
      throw new Error(`Expected isFreeTier to be true, got ${updatedUser.isFreeTier}`);
    }

    if (updatedUser.totalRemainingMessages !== 3) {
      throw new Error(`Expected totalRemainingMessages to be 3, got ${updatedUser.totalRemainingMessages}`);
    }

    console.log('✅ PASSED: Single subscription expired and fell back to Free Tier.');

  } catch (error) {
    console.error('❌ FAILED: Single Subscription E2E test failed', error);
    process.exit(1);
  } finally {
    // Cleanup
    await db.delete(subscriptions).where(eq(subscriptions.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
    await db.delete(bundleTiers).where(eq(bundleTiers.id, bundleTierId));
    console.log('Cleanup complete.');
    process.exit(0);
  }
}

runSingleSubscriptionE2ETest();
