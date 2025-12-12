import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

import { db } from '~/shared/infra/db/config/config';
import { users } from '~/shared/infra/db/schemas/users';
import { manualFreeTierReset } from '~/shared/infra/cron/jobs/free_tier_reset.job';

async function runCronE2ETest() {
  console.log('🚀 Starting Cron Job E2E Test (Free Tier Reset)...');

  const userId = uuidv4();

  try {
    // 1. Create a user on free tier with 0 messages
    console.log('Creating test user with 0 messages...');
    await db.insert(users).values({
      id: userId,
      email: `cron-test-${userId}@example.com`,
      password: 'hashed_password',
      role: 'user',
      isFreeTier: true,
      totalRemainingMessages: 0,
      latestBundleRemainingQuota: 0,
      latestBundleId: null,
    });

    // 2. Run the cron job manually
    console.log('Running manual free tier reset...');
    await manualFreeTierReset();

    // 3. Verify user quota is reset to 3
    const [updatedUser] = await db.select().from(users).where(eq(users.id, userId));

    if (!updatedUser) {
      throw new Error('User not found after cron job');
    }

    if (updatedUser.totalRemainingMessages !== 3) {
      throw new Error(`Expected totalRemainingMessages to be 3, got ${updatedUser.totalRemainingMessages}`);
    }

    if (updatedUser.latestBundleRemainingQuota !== 3) {
      throw new Error(`Expected latestBundleRemainingQuota to be 3, got ${updatedUser.latestBundleRemainingQuota}`);
    }

    console.log('✅ PASSED: User quota reset to 3 successfully.');

  } catch (error) {
    console.error('❌ FAILED: Cron E2E test failed', error);
    process.exit(1);
  } finally {
    // Cleanup
    await db.delete(users).where(eq(users.id, userId));
    console.log('Cleanup complete.');
    process.exit(0);
  }
}

runCronE2ETest();
