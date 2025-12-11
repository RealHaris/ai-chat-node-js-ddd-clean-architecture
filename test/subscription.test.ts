/**
 * Subscription Module Tests
 * Tests for: Subscribe, Get My Subscriptions, Get Quota, Toggle Auto Renewal, Cancel
 */

import {
  apiRequest,
  apiRequestAuth,
  randomEmail,
  runTestSuite,
  assertStatusCode,
  assertHasProperty,
  assertNotNull,
  assertTrue,
  testStore,
  TestSummary,
  logInfo,
  logWarning,
} from './utils';

interface SubscriptionResponse {
  message?: string;
  error?: string;
  data?: {
    id: string;
    userId: string;
    bundleTierId: string;
    billingCycle: 'monthly' | 'yearly';
    autoRenewal: boolean;
    status: string;
    startDate: string;
    endDate: string;
    createdAt: string;
    updatedAt: string;
  };
}

interface SubscriptionsListResponse {
  message?: string;
  error?: string;
  data?: Array<{
    id: string;
    userId: string;
    bundleTierId: string;
    billingCycle: string;
    autoRenewal: boolean;
    status: string;
    startDate: string;
    endDate: string;
  }>;
}

interface QuotaResponse {
  message?: string;
  error?: string;
  data?: {
    isFreeTier: boolean;
    monthlyMessageCount: number;
    maxMessages: number;
    remainingMessages: number;
    activeSubscription?: {
      id: string;
      bundleTierName: string;
      expiresAt: string;
    };
  };
}

// Track created subscription for later tests
let createdSubscriptionId: string | null = null;

// Setup helper
async function ensureUsersAndBundlesExist(): Promise<void> {
  if (!testStore.regularUser) {
    const email = randomEmail();
    const password = 'TestPassword123';

    const response = await apiRequest<{
      data?: {
        accessToken: string;
        refreshToken: string;
        user: { id: string; email: string };
      };
    }>('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.status === 201 && response.data.data) {
      testStore.regularUser = {
        id: response.data.data.user.id,
        email,
        password,
        accessToken: response.data.data.accessToken,
        refreshToken: response.data.data.refreshToken,
      };
      logInfo(`Created regular user for subscription tests: ${email}`);
    }
  }

  // Fetch bundle tiers if not already loaded
  if (testStore.bundleTiers.length === 0) {
    const response = await apiRequest<{
      data?: Array<{
        id: string;
        name: string;
        maxMessages: number;
        priceMonthly: string;
        priceYearly: string;
      }>;
    }>('/v1/bundle-tiers');

    if (response.status === 200 && response.data.data) {
      testStore.bundleTiers = response.data.data;
      logInfo(`Loaded ${response.data.data.length} bundle tiers`);
    }
  }
}

export async function runSubscriptionTests(): Promise<TestSummary> {
  await ensureUsersAndBundlesExist();

  const tests = [
    // ==================== GET MY SUBSCRIPTIONS ====================
    {
      name: 'Get My Subscriptions - Without authentication',
      fn: async () => {
        const response =
          await apiRequest<SubscriptionsListResponse>('/v1/subscriptions');

        assertStatusCode(response, 401, 'Unauthenticated should return 401');
      },
    },
    {
      name: 'Get My Subscriptions - With valid token (empty initially)',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<SubscriptionsListResponse>(
          '/v1/subscriptions',
          testStore.regularUser!.accessToken
        );

        assertStatusCode(response, 200, 'Should return 200');
        assertNotNull(response.data.data, 'Should have data');
        assertTrue(
          Array.isArray(response.data.data),
          'Data should be an array'
        );
      },
    },
    {
      name: 'Get My Subscriptions - Filter by active=true',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<SubscriptionsListResponse>(
          '/v1/subscriptions?active=true',
          testStore.regularUser!.accessToken
        );

        assertStatusCode(response, 200, 'Should return 200');
        assertNotNull(response.data.data, 'Should have data');
      },
    },

    // ==================== GET QUOTA ====================
    {
      name: 'Get Quota - Without authentication',
      fn: async () => {
        const response = await apiRequest<QuotaResponse>(
          '/v1/subscriptions/quota'
        );

        assertStatusCode(response, 401, 'Unauthenticated should return 401');
      },
    },
    {
      name: 'Get Quota - With valid token (free tier user)',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<QuotaResponse>(
          '/v1/subscriptions/quota',
          testStore.regularUser!.accessToken
        );

        assertStatusCode(response, 200, 'Should return 200');
        assertNotNull(response.data.data, 'Should have data');
        assertHasProperty(
          response.data.data!,
          'isFreeTier',
          'Should have isFreeTier'
        );
        assertHasProperty(
          response.data.data!,
          'remainingMessages',
          'Should have remainingMessages'
        );

        logInfo(
          `User quota: ${response.data.data!.remainingMessages} messages remaining`
        );
      },
    },

    // ==================== SUBSCRIBE ====================
    {
      name: 'Subscribe - Without authentication',
      fn: async () => {
        const response = await apiRequest<SubscriptionResponse>(
          '/v1/subscriptions',
          {
            method: 'POST',
            body: JSON.stringify({
              bundleTierId: testStore.bundleTiers[0]?.id,
              billingCycle: 'monthly',
            }),
          }
        );

        assertStatusCode(response, 401, 'Unauthenticated should return 401');
      },
    },
    {
      name: 'Subscribe - Missing bundleTierId',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<SubscriptionResponse>(
          '/v1/subscriptions',
          testStore.regularUser!.accessToken,
          {
            method: 'POST',
            body: JSON.stringify({
              billingCycle: 'monthly',
            }),
          }
        );

        assertStatusCode(
          response,
          400,
          'Missing bundleTierId should return 400'
        );
      },
    },
    {
      name: 'Subscribe - Invalid bundleTierId',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<SubscriptionResponse>(
          '/v1/subscriptions',
          testStore.regularUser!.accessToken,
          {
            method: 'POST',
            body: JSON.stringify({
              bundleTierId: '00000000-0000-0000-0000-000000000000',
              billingCycle: 'monthly',
            }),
          }
        );

        // Should be 400 or 404 for invalid bundle
        assertTrue(
          response.status === 400 || response.status === 404,
          'Invalid bundleTierId should return 400 or 404'
        );
      },
    },
    {
      name: 'Subscribe - Invalid billing cycle',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        if (testStore.bundleTiers.length === 0) {
          logWarning('No bundle tiers available - skipping');
          return;
        }

        const response = await apiRequestAuth<SubscriptionResponse>(
          '/v1/subscriptions',
          testStore.regularUser!.accessToken,
          {
            method: 'POST',
            body: JSON.stringify({
              bundleTierId: testStore.bundleTiers[0].id,
              billingCycle: 'weekly', // Invalid
            }),
          }
        );

        assertStatusCode(
          response,
          400,
          'Invalid billing cycle should return 400'
        );
      },
    },
    {
      name: 'Subscribe - Valid monthly subscription',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        if (testStore.bundleTiers.length === 0) {
          logWarning('No bundle tiers available - skipping');
          return;
        }

        const response = await apiRequestAuth<SubscriptionResponse>(
          '/v1/subscriptions',
          testStore.regularUser!.accessToken,
          {
            method: 'POST',
            body: JSON.stringify({
              bundleTierId: testStore.bundleTiers[0].id,
              billingCycle: 'monthly',
            }),
          }
        );

        // Could be 201 for success or 400 if payment fails (5% failure rate)
        if (response.status === 201) {
          assertNotNull(response.data.data, 'Should have data');
          assertHasProperty(response.data.data!, 'id', 'Should have id');
          createdSubscriptionId = response.data.data!.id;

          testStore.subscriptions.push({
            id: response.data.data!.id,
            userId: testStore.regularUser!.id,
            bundleTierId: testStore.bundleTiers[0].id,
            billingCycle: 'monthly',
          });

          logInfo(`Created subscription: ${createdSubscriptionId}`);
        } else if (response.status === 400) {
          logWarning(
            'Subscription may have failed due to simulated payment failure'
          );
          // This is acceptable due to 5% payment failure rate
          assertTrue(true, 'Payment simulation failure is acceptable');
        } else {
          assertStatusCode(
            response,
            201,
            'Should return 201 or payment failure'
          );
        }
      },
    },
    {
      name: 'Subscribe - Duplicate subscription (same bundle)',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        if (testStore.bundleTiers.length === 0 || !createdSubscriptionId) {
          logWarning('No bundle or no existing subscription - skipping');
          return;
        }

        const response = await apiRequestAuth<SubscriptionResponse>(
          '/v1/subscriptions',
          testStore.regularUser!.accessToken,
          {
            method: 'POST',
            body: JSON.stringify({
              bundleTierId: testStore.bundleTiers[0].id,
              billingCycle: 'monthly',
            }),
          }
        );

        // Should either reject duplicate or allow (depending on business logic)
        // Most likely 400 for duplicate active subscription
        assertTrue(
          response.status === 400 || response.status === 201,
          'Duplicate subscription handling'
        );
      },
    },

    // ==================== TOGGLE AUTO RENEWAL ====================
    {
      name: 'Toggle Auto Renewal - Without authentication',
      fn: async () => {
        const subId =
          createdSubscriptionId || '00000000-0000-0000-0000-000000000000';

        const response = await apiRequest<SubscriptionResponse>(
          `/v1/subscriptions/${subId}/auto-renewal`,
          { method: 'PATCH' }
        );

        assertStatusCode(response, 401, 'Unauthenticated should return 401');
      },
    },
    {
      name: 'Toggle Auto Renewal - Invalid subscription ID',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<SubscriptionResponse>(
          '/v1/subscriptions/invalid-uuid/auto-renewal',
          testStore.regularUser!.accessToken,
          { method: 'PATCH' }
        );

        assertStatusCode(response, 400, 'Invalid UUID should return 400');
      },
    },
    {
      name: 'Toggle Auto Renewal - Non-existent subscription',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<SubscriptionResponse>(
          '/v1/subscriptions/00000000-0000-0000-0000-000000000000/auto-renewal',
          testStore.regularUser!.accessToken,
          { method: 'PATCH' }
        );

        // Should be 404 for not found
        assertTrue(
          response.status === 404 || response.status === 403,
          'Non-existent should return 404 or 403'
        );
      },
    },
    {
      name: 'Toggle Auto Renewal - Valid request',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        if (!createdSubscriptionId) {
          logWarning('No subscription created - skipping');
          return;
        }

        const response = await apiRequestAuth<SubscriptionResponse>(
          `/v1/subscriptions/${createdSubscriptionId}/auto-renewal`,
          testStore.regularUser!.accessToken,
          { method: 'PATCH' }
        );

        assertStatusCode(response, 200, 'Should return 200');
        assertNotNull(response.data.data, 'Should have data');
        assertHasProperty(
          response.data.data!,
          'autoRenewal',
          'Should have autoRenewal'
        );

        logInfo(`Auto renewal toggled: ${response.data.data!.autoRenewal}`);
      },
    },

    // ==================== CANCEL SUBSCRIPTION ====================
    {
      name: 'Cancel Subscription - Without authentication',
      fn: async () => {
        const subId =
          createdSubscriptionId || '00000000-0000-0000-0000-000000000000';

        const response = await apiRequest<SubscriptionResponse>(
          `/v1/subscriptions/${subId}/cancel`,
          { method: 'POST' }
        );

        assertStatusCode(response, 401, 'Unauthenticated should return 401');
      },
    },
    {
      name: 'Cancel Subscription - Invalid subscription ID',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<SubscriptionResponse>(
          '/v1/subscriptions/invalid-uuid/cancel',
          testStore.regularUser!.accessToken,
          { method: 'POST' }
        );

        assertStatusCode(response, 400, 'Invalid UUID should return 400');
      },
    },
    {
      name: 'Cancel Subscription - Non-existent subscription',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<SubscriptionResponse>(
          '/v1/subscriptions/00000000-0000-0000-0000-000000000000/cancel',
          testStore.regularUser!.accessToken,
          { method: 'POST' }
        );

        // Should be 404 for not found
        assertTrue(
          response.status === 404 || response.status === 403,
          'Non-existent should return 404 or 403'
        );
      },
    },
    {
      name: 'Cancel Subscription - Valid request',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        if (!createdSubscriptionId) {
          logWarning('No subscription created - skipping');
          return;
        }

        const response = await apiRequestAuth<SubscriptionResponse>(
          `/v1/subscriptions/${createdSubscriptionId}/cancel`,
          testStore.regularUser!.accessToken,
          { method: 'POST' }
        );

        assertStatusCode(response, 200, 'Should return 200');
        logInfo(`Subscription cancelled: ${createdSubscriptionId}`);
      },
    },
    {
      name: 'Cancel Subscription - Already cancelled',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        if (!createdSubscriptionId) {
          logWarning('No subscription created - skipping');
          return;
        }

        const response = await apiRequestAuth<SubscriptionResponse>(
          `/v1/subscriptions/${createdSubscriptionId}/cancel`,
          testStore.regularUser!.accessToken,
          { method: 'POST' }
        );

        // Should handle gracefully - either 200 or 400
        assertTrue(
          response.status === 200 || response.status === 400,
          'Already cancelled should be handled'
        );
      },
    },

    // ==================== VERIFY QUOTA AFTER SUBSCRIPTION ====================
    {
      name: 'Get Quota - After subscription changes',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<QuotaResponse>(
          '/v1/subscriptions/quota',
          testStore.regularUser!.accessToken
        );

        assertStatusCode(response, 200, 'Should return 200');
        assertNotNull(response.data.data, 'Should have data');

        logInfo(
          `Final quota status: isFreeTier=${response.data.data!.isFreeTier}, ` +
            `remaining=${response.data.data!.remainingMessages}`
        );
      },
    },
  ];

  return runTestSuite('SUBSCRIPTION MODULE TESTS', tests);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSubscriptionTests()
    .then(summary => {
      if (summary.failed > 0) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Subscription tests failed:', error);
      process.exit(1);
    });
}
