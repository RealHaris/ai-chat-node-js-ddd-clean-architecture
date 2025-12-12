import 'reflect-metadata';
import 'reflect-metadata';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

import { db } from '~/shared/infra/db/config/config';
import { subscriptions } from '~/shared/infra/db/schemas/subscriptions';
import { users } from '~/shared/infra/db/schemas/users';
import { handleSubscriptionExpiry } from '~/shared/infra/queue/workers/subscription_expiry.worker';

// Simple assertion helper
function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

// Mock SubscriptionReadRepository
class MockSubscriptionReadRepository {
  private mockActiveSubscriptions: any[] = [];

  setMockActiveSubscriptions(subs: any[]) {
    this.mockActiveSubscriptions = subs;
  }

  async findActiveByUserId(userId: string): Promise<any[]> {
    return this.mockActiveSubscriptions;
  }
}

import { bundleTiers } from '~/shared/infra/db/schemas/bundle_tiers';

// ... (imports)

async function runTests() {
  console.log('🚀 Starting SubscriptionExpiryWorker Logic Tests...');

  const userId = uuidv4();
  const bundleTierId = uuidv4();
  const mockRepo = new MockSubscriptionReadRepository();

  try {
    // Setup Bundle Tier
    await db.insert(bundleTiers).values({
      id: bundleTierId,
      name: 'Test Bundle',
      maxMessages: 10,
      priceMonthly: '10.00',
      priceYearly: '100.00',
    });

    // Setup User
    await db.insert(users).values({
      id: userId,
      email: `test-${userId}@example.com`,
      password: 'hashed_password',
      role: 'user',
      totalRemainingMessages: 10,
      isFreeTier: false,
      latestBundleId: null,
      latestBundleRemainingQuota: 0,
    });

    // =================================================================
    // TEST 1: Fallback to next active bundle when auto-renewal is OFF
    // =================================================================
    console.log('\nTest 1: Fallback to next active bundle');
    
    const subId1 = uuidv4(); // Expiring
    const subId2 = uuidv4(); // Fallback

    // Create expiring subscription
    await db.insert(subscriptions).values({
      id: subId1,
      userId,
      bundleTierId,
      bundleName: 'Bundle 1',
      bundleMaxMessages: 10,
      bundlePrice: '10.00',
      billingCycle: 'monthly',
      autoRenewal: false,
      status: true,
      startDate: new Date(),
      endDate: new Date(),
      renewalDate: new Date(),
    });

    // Create fallback subscription
    await db.insert(subscriptions).values({
      id: subId2,
      userId,
      bundleTierId,
      bundleName: 'Bundle 2',
      bundleMaxMessages: 20,
      bundlePrice: '20.00',
      billingCycle: 'monthly',
      autoRenewal: true,
      status: true,
      startDate: new Date(),
      endDate: new Date(Date.now() + 1000000),
      renewalDate: new Date(Date.now() + 1000000),
    });

    // Update user state
    await db.update(users).set({
      latestBundleId: subId1,
      latestBundleRemainingQuota: 5,
      totalRemainingMessages: 25, // 5 from Bundle 1 + 20 from Bundle 2
    }).where(eq(users.id, userId));

    // Mock repository response
    mockRepo.setMockActiveSubscriptions([
      { id: subId2, bundleName: 'Bundle 2', bundleMaxMessages: 20 }
    ]);

    // Act
    await handleSubscriptionExpiry(
      userId,
      subId1,
      'Auto-renewal disabled',
      mockRepo as any
    );

    // Assert
    const [updatedUser] = await db.select().from(users).where(eq(users.id, userId));
    
    assert(updatedUser.latestBundleId === subId2, `Latest bundle should be ${subId2}`);
    assert(updatedUser.totalRemainingMessages === 20, `Total remaining should be 20 (25 - 5)`);
    assert(updatedUser.isFreeTier === false, `Should not be free tier`);

    // =================================================================
    // TEST 2: Shift to free tier when no other active bundles exist
    // =================================================================
    console.log('\nTest 2: Shift to free tier when no active bundles');

    // Reset user state for Test 2
    await db.update(users).set({
      latestBundleId: subId1,
      latestBundleRemainingQuota: 5,
      totalRemainingMessages: 5,
      isFreeTier: false,
    }).where(eq(users.id, userId));

    // Mock repository response (empty)
    mockRepo.setMockActiveSubscriptions([]);

    // Act
    await handleSubscriptionExpiry(
      userId,
      subId1,
      'Auto-renewal disabled',
      mockRepo as any
    );

    // Assert
    const [updatedUser2] = await db.select().from(users).where(eq(users.id, userId));

    assert(updatedUser2.isFreeTier === true, `Should be free tier`);
    assert(updatedUser2.totalRemainingMessages === 3, `Total remaining should be 3 (Free Tier default)`);
    assert(updatedUser2.latestBundleId === null, `Latest bundle should be null`);

  } catch (error) {
    console.error('Test failed with error:', error);
    process.exit(1);
  } finally {
    // Cleanup
    await db.delete(subscriptions).where(eq(subscriptions.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
    await db.delete(bundleTiers).where(eq(bundleTiers.id, bundleTierId));
    console.log('\nCleanup complete.');
    process.exit(0);
  }
}

runTests();
