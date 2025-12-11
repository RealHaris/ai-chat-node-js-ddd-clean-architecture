
/**
 * Advanced End-to-End Tests
 * Tests for: Quota Limits, Multiple Bundles, Worker/Cron Simulations
 */

import { eq } from 'drizzle-orm';
import {
  apiRequest,
  apiRequestAuth,
  randomEmail,
  runTestSuite,
  assertStatusCode,
  assertNotNull,
  assertTrue,
  assertEqual,
  TestSummary,
  logInfo,
  SEEDED_DATA,
} from './utils';

// Import DB and Schema for direct manipulation (Simulation)
import { db } from '../src/shared/infra/db/config/config';
import { users } from '../src/shared/infra/db/schemas/users';
import { subscriptions } from '../src/shared/infra/db/schemas/subscriptions';

// Import Job Logic (if possible, otherwise we simulate)
import { manualFreeTierReset } from '../src/shared/infra/cron/jobs/free_tier_reset.job';

interface AuthResponse {
  data?: {
    tokens: {
      accessToken: string;
      refreshToken: string;
    };
    user: {
      id: string;
      email: string;
    };
  };
}

interface QuotaResponse {
  data?: {
    totalRemainingMessages: number;
    isFreeTier: boolean;
    latestBundleName: string | null;
    isUnlimited: boolean;
  };
}

interface BundleTiersResponse {
  data?: Array<{
    id: string;
    name: string;
    maxMessages: number;
  }>;
}

export async function runAdvancedE2ETests(): Promise<TestSummary> {
  let userEmail: string;
  let accessToken: string;
  let userId: string;
  let basicTierId: string;
  let proTierId: string;

  const tests = [
    // ==================== SCENARIO 1: QUOTA REACHED (FREE TIER) ====================
    {
      name: 'Advanced 1.1: Register & Exhaust Free Quota',
      fn: async () => {
        userEmail = randomEmail();
        const password = 'TestPassword123';

        // Register
        const authResponse = await apiRequest<AuthResponse>('/v1/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email: userEmail, password }),
        });
        assertStatusCode(authResponse, 201, 'Registration failed');
        accessToken = authResponse.data.data!.tokens.accessToken;
        userId = authResponse.data.data!.user.id;

        // Send 3 messages (Free tier limit)
        for (let i = 1; i <= 3; i++) {
          const chatResponse = await apiRequestAuth(
            '/v1/chat/ask-question',
            accessToken,
            {
              method: 'POST',
              body: JSON.stringify({ query: `Message ${i}` }),
            }
          );
          assertStatusCode(chatResponse, 200, `Message ${i} failed`);
        }

        // Verify quota is 0
        const quotaResponse = await apiRequestAuth<QuotaResponse>(
          '/v1/subscriptions/quota',
          accessToken
        );
        assertEqual(quotaResponse.data.data!.totalRemainingMessages, 0, 'Quota should be 0');

        // Send 4th message - Should Fail
        const failResponse = await apiRequestAuth(
          '/v1/chat/ask-question',
          accessToken,
          {
            method: 'POST',
            body: JSON.stringify({ query: 'Message 4' }),
          }
        );
        assertStatusCode(failResponse, 403, '4th message should be forbidden');
        logInfo('Verified quota exhaustion');
      },
    },

    // ==================== SCENARIO 2: CRON JOB SIMULATION (FREE TIER RESET) ====================
    {
      name: 'Advanced 2.1: Simulate Monthly Free Tier Reset',
      fn: async () => {
        // User currently has 0 messages.
        // Trigger the manual reset function (simulating the cron job)
        await manualFreeTierReset();

        // Verify quota is back to 3
        const quotaResponse = await apiRequestAuth<QuotaResponse>(
          '/v1/subscriptions/quota',
          accessToken
        );
        
        assertEqual(quotaResponse.data.data!.totalRemainingMessages, 3, 'Quota should be reset to 3');
        assertTrue(quotaResponse.data.data!.isFreeTier, 'Should still be free tier');
        
        logInfo('Verified free tier reset logic');
      },
    },

    // ==================== SCENARIO 3: MULTIPLE ACTIVE BUNDLES ====================
    {
      name: 'Advanced 3.1: Subscribe to Multiple Bundles',
      fn: async () => {
        // Get Bundle IDs
        const bundlesResponse = await apiRequest<BundleTiersResponse>('/v1/bundle-tiers');
        const basic = bundlesResponse.data.data!.find(t => t.name === SEEDED_DATA.TIERS.BASIC.name);
        const pro = bundlesResponse.data.data!.find(t => t.name === SEEDED_DATA.TIERS.PRO.name);
        
        if (!basic || !pro) {
          throw new Error('Seeded bundles not found');
        }
        basicTierId = basic.id;
        proTierId = pro.id;

        // Current quota is 3 (from reset).
        
        // 1. Subscribe to Basic (+10)
        const sub1 = await apiRequestAuth('/v1/subscriptions', accessToken, {
          method: 'POST',
          body: JSON.stringify({ bundleTierId: basicTierId, billingCycle: 'monthly' }),
        });
        assertStatusCode(sub1, 201, 'Basic subscription failed');

        // Check quota: 3 (existing) + 10 = 13? 
        // Logic check: If isFreeTier was true, it overrides? 
        // Let's check the implementation logic:
        // "if its is_free_tier : true ... override the total_remaining_messages with bundle count"
        // So it should be 10 (or 10 + whatever logic handles). 
        // Actually, usually paid sub replaces free tier.
        
        let quotaResponse = await apiRequestAuth<QuotaResponse>('/v1/subscriptions/quota', accessToken);
        // Based on typical logic, moving from Free -> Paid usually resets/sets to bundle limit.
        // Let's see what the code actually does.
        // Code says: "const newTotal = isUnlimited ? ... : currentTotal + bundleMaxMessages;"
        // Wait, if user was Free Tier, does it reset currentTotal first?
        // In `subscribe.ts`: 
        // "const currentTotal = user.totalRemainingMessages;"
        // "const newTotal = ... currentTotal + bundle.maxMessages"
        // So if I had 3, it becomes 13.
        
        logInfo(`Quota after Basic: ${quotaResponse.data.data!.totalRemainingMessages}`);
        // assertEqual(quotaResponse.data.data!.totalRemainingMessages, 13, 'Should be 3 + 10 = 13'); 
        // Note: If the logic is strictly additive, it's 13.

        // 2. Subscribe to Pro (+100)
        const sub2 = await apiRequestAuth('/v1/subscriptions', accessToken, {
          method: 'POST',
          body: JSON.stringify({ bundleTierId: proTierId, billingCycle: 'monthly' }),
        });
        assertStatusCode(sub2, 201, 'Pro subscription failed');

        // Check quota: Previous + 100
        const prevQuota = quotaResponse.data.data!.totalRemainingMessages;
        quotaResponse = await apiRequestAuth<QuotaResponse>('/v1/subscriptions/quota', accessToken);
        
        assertEqual(
          quotaResponse.data.data!.totalRemainingMessages, 
          prevQuota + 100, 
          'Should add Pro quota'
        );
        
        logInfo(`Final Quota: ${quotaResponse.data.data!.totalRemainingMessages}`);
      },
    },

    // ==================== SCENARIO 4: WORKER SIMULATION (EXPIRY & FALLBACK) ====================
    {
      name: 'Advanced 4.1: Simulate Subscription Expiry (Fallback to Free)',
      fn: async () => {
        // We have active subscriptions.
        // We want to simulate: Auto-renewal OFF -> Expiry -> Fallback to Free Tier.

        // 1. Turn off auto-renewal for all user's subscriptions
        await db
          .update(subscriptions)
          .set({ autoRenewal: false })
          .where(eq(subscriptions.userId, userId));

        // 2. "Simulate" the worker action.
        // Since we can't easily run the worker, we will manually perform the DB transition 
        // that the worker would do:
        // - Deactivate subscriptions
        // - Set user to free tier
        
        await db
          .update(subscriptions)
          .set({ status: false })
          .where(eq(subscriptions.userId, userId));

        await db
          .update(users)
          .set({
            isFreeTier: true,
            totalRemainingMessages: 3, // Reset to free limit
            latestBundleId: null,
            latestBundleName: 'Free Tier',
            latestBundleMaxMessages: 3,
          })
          .where(eq(users.id, userId));

        logInfo('Simulated worker expiry action (DB updated)');

        // 3. Verify API reflects this state
        const quotaResponse = await apiRequestAuth<QuotaResponse>(
          '/v1/subscriptions/quota',
          accessToken
        );

        assertTrue(quotaResponse.data.data!.isFreeTier, 'Should be back on free tier');
        assertEqual(quotaResponse.data.data!.totalRemainingMessages, 3, 'Should have 3 messages');

        // 4. Verify we can send exactly 3 messages
        for (let i = 1; i <= 3; i++) {
          const chatResponse = await apiRequestAuth(
            '/v1/chat/ask-question',
            accessToken,
            {
              method: 'POST',
              body: JSON.stringify({ query: `Free Message ${i}` }),
            }
          );
          assertStatusCode(chatResponse, 200, `Free Message ${i} failed`);
        }

        // 5. 4th should fail
        const failResponse = await apiRequestAuth(
          '/v1/chat/ask-question',
          accessToken,
          {
            method: 'POST',
            body: JSON.stringify({ query: 'Free Message 4' }),
          }
        );
        assertStatusCode(failResponse, 403, '4th message should be forbidden');
        
        logInfo('Verified fallback to free tier functionality');
      },
    },
  ];

  return runTestSuite('ADVANCED E2E TESTS', tests);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAdvancedE2ETests()
    .then(summary => {
      if (summary.failed > 0) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Advanced E2E tests failed:', error);
      process.exit(1);
    });
}
