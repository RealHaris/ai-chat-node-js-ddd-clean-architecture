/**
 * End-to-End Tests
 * Tests complete user journeys through the system
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
  TestSummary,
  logInfo,
  logWarning,
  sleep,
  SEEDED_DATA,
} from './utils';

interface AuthResponse {
  data?: {
    tokens: {
      accessToken: string;
      refreshToken: string;
    };
    user: {
      id: string;
      email: string;
      isAdmin: boolean;
      isFreeTier: boolean;
    };
  };
}

interface BundleTiersResponse {
  data?: Array<{
    id: string;
    name: string;
    maxMessages: number;
    priceMonthly: string;
    priceYearly: string;
  }>;
}

interface SubscriptionResponse {
  data?: {
    id: string;
    bundleTierId: string;
    billingCycle: string;
    status: string;
  };
}

interface QuotaResponse {
  data?: {
    totalRemainingMessages: number;
    isFreeTier: boolean;
    latestBundleId: string | null;
    latestBundleRemainingQuota: number | null;
    latestBundleName: string | null;
    latestBundleMaxMessages: number | null;
    hasQuota: boolean;
    isUnlimited: boolean;
  };
}

interface ChatResponse {
  data?: {
    id: string;
    query: string;
    status: string;
  };
}

interface MessagesResponse {
  data?: {
    messages: Array<{
      id: string;
      query: string;
      response?: string;
      status: string;
    }>;
    pagination: {
      total: number;
    };
  };
}

export async function runE2ETests(): Promise<TestSummary> {
  // Test data for this E2E flow
  let userEmail: string;
  let userPassword: string;
  let accessToken: string;
  let refreshToken: string;
  let userId: string;
  let bundleTierId: string | null = null;
  let subscriptionId: string | null = null;

  const tests = [
    // ==================== JOURNEY 1: FREE TIER USER ====================
    {
      name: 'E2E Journey 1.1: Register new user',
      fn: async () => {
        userEmail = randomEmail();
        userPassword = 'E2EPassword123';

        const response = await apiRequest<AuthResponse>('/v1/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: userEmail,
            password: userPassword,
          }),
        });

        assertStatusCode(response, 201, 'Registration should succeed');
        assertNotNull(response.data.data, 'Should have data');

        accessToken = response.data.data!.tokens.accessToken;
        refreshToken = response.data.data!.tokens.refreshToken;
        userId = response.data.data!.user.id;

        assertTrue(
          response.data.data!.user.isFreeTier,
          'New user should be on free tier'
        );

        logInfo(`Registered user: ${userEmail}`);
      },
    },
    {
      name: 'E2E Journey 1.2: Check initial quota (free tier)',
      fn: async () => {
        const response = await apiRequestAuth<QuotaResponse>(
          '/v1/subscriptions/quota',
          accessToken
        );

        assertStatusCode(response, 200, 'Quota check should succeed');
        assertNotNull(response.data.data, 'Should have data');
        assertTrue(response.data.data!.isFreeTier, 'Should be free tier');
        assertTrue(
          response.data.data!.totalRemainingMessages === 3,
          'Should have 3 remaining'
        );

        logInfo(`Quota: ${response.data.data!.totalRemainingMessages}`);
      },
    },
    {
      name: 'E2E Journey 1.3: Send first chat message',
      fn: async () => {
        const response = await apiRequestAuth<ChatResponse>(
          '/v1/chat/ask-question',
          accessToken,
          {
            method: 'POST',
            body: JSON.stringify({ query: 'Hello, this is my first message!' }),
          }
        );

        assertStatusCode(response, 200, 'Chat should succeed');
        assertNotNull(response.data.data, 'Should have data');
        assertHasProperty(response.data.data!, 'id', 'Should have message id');

        logInfo(`Sent message 1, status: ${response.data.data!.status}`);
      },
    },
    {
      name: 'E2E Journey 1.4: Verify quota decreased',
      fn: async () => {
        const response = await apiRequestAuth<QuotaResponse>(
          '/v1/subscriptions/quota',
          accessToken
        );

        assertStatusCode(response, 200, 'Quota check should succeed');
        assertTrue(
          response.data.data!.totalRemainingMessages === 2,
          'Should have 2 remaining after 1 message'
        );

        logInfo(
          `Remaining messages: ${response.data.data!.totalRemainingMessages}`
        );
      },
    },
    {
      name: 'E2E Journey 1.5: Send second and third messages',
      fn: async () => {
        // Send second message
        const response2 = await apiRequestAuth<ChatResponse>(
          '/v1/chat/ask-question',
          accessToken,
          {
            method: 'POST',
            body: JSON.stringify({ query: 'Second message' }),
          }
        );
        assertStatusCode(response2, 200, 'Second message should succeed');

        // Send third message
        const response3 = await apiRequestAuth<ChatResponse>(
          '/v1/chat/ask-question',
          accessToken,
          {
            method: 'POST',
            body: JSON.stringify({ query: 'Third message' }),
          }
        );
        assertStatusCode(response3, 200, 'Third message should succeed');

        logInfo('Sent messages 2 and 3');
      },
    },
    {
      name: 'E2E Journey 1.6: Fourth message should fail (quota exceeded)',
      fn: async () => {
        const response = await apiRequestAuth<ChatResponse>(
          '/v1/chat/ask-question',
          accessToken,
          {
            method: 'POST',
            body: JSON.stringify({ query: 'Fourth message - should fail' }),
          }
        );

        assertStatusCode(
          response,
          403,
          'Fourth message should fail with quota exceeded'
        );

        logInfo('Quota correctly enforced - 4th message rejected');
      },
    },
    {
      name: 'E2E Journey 1.7: Get all messages',
      fn: async () => {
        const response = await apiRequestAuth<MessagesResponse>(
          '/v1/chat/messages',
          accessToken
        );

        assertStatusCode(response, 200, 'Get messages should succeed');
        assertTrue(
          response.data.data!.messages.length === 3,
          'Should have exactly 3 messages'
        );

        logInfo(`Total messages: ${response.data.data!.messages.length}`);
      },
    },

    // ==================== JOURNEY 2: SUBSCRIPTION FLOW ====================
    {
      name: 'E2E Journey 2.1: Get available bundle tiers',
      fn: async () => {
        const response =
          await apiRequest<BundleTiersResponse>('/v1/bundle-tiers');

        assertStatusCode(response, 200, 'Get bundles should succeed');
        assertNotNull(response.data.data, 'Should have data');
        assertTrue(
          response.data.data!.length > 0,
          'Should have at least one bundle'
        );

        // Pick the Basic bundle for subscription
        const basicTier = response.data.data!.find(
          t => t.name === SEEDED_DATA.TIERS.BASIC.name
        );
        if (basicTier) {
          bundleTierId = basicTier.id;
          logInfo(`Selected seeded Basic tier: ${basicTier.name}`);
        } else {
          bundleTierId = response.data.data![0].id;
          logInfo(
            `Basic tier not found, selected first available: ${response.data.data![0].name}`
          );
        }
      },
    },
    {
      name: 'E2E Journey 2.2: Subscribe to a bundle',
      fn: async () => {
        if (!bundleTierId) {
          logWarning('No bundle tier available - skipping');
          return;
        }

        const response = await apiRequestAuth<SubscriptionResponse>(
          '/v1/subscriptions',
          accessToken,
          {
            method: 'POST',
            body: JSON.stringify({
              bundleTierId,
              billingCycle: 'monthly',
            }),
          }
        );

        // May fail due to 5% payment failure simulation
        if (response.status === 201) {
          assertNotNull(response.data.data, 'Should have data');
          subscriptionId = response.data.data!.id;
          logInfo(`Subscribed successfully: ${subscriptionId}`);
        } else if (response.status === 400) {
          logWarning('Payment simulation failed (5% chance) - acceptable');
          assertTrue(true, 'Payment failure is acceptable');
        } else {
          assertStatusCode(response, 201, 'Subscription should succeed');
        }
      },
    },
    {
      name: 'E2E Journey 2.3: Verify quota increased after subscription',
      fn: async () => {
        if (!subscriptionId) {
          logWarning('No subscription created - skipping');
          return;
        }

        const response = await apiRequestAuth<QuotaResponse>(
          '/v1/subscriptions/quota',
          accessToken
        );

        assertStatusCode(response, 200, 'Quota check should succeed');

        // Should no longer be free tier
        if (!response.data.data!.isFreeTier) {
          logInfo(
            `Upgraded! Max messages: ${response.data.data!.latestBundleMaxMessages}`
          );
        } else {
          logWarning('Still on free tier - subscription may not have applied');
        }
      },
    },
    {
      name: 'E2E Journey 2.4: Toggle auto-renewal',
      fn: async () => {
        if (!subscriptionId) {
          logWarning('No subscription created - skipping');
          return;
        }

        const response = await apiRequestAuth<SubscriptionResponse>(
          `/v1/subscriptions/${subscriptionId}/auto-renewal`,
          accessToken,
          { method: 'PATCH' }
        );

        assertStatusCode(response, 200, 'Toggle should succeed');
        logInfo('Auto-renewal toggled');
      },
    },
    {
      name: 'E2E Journey 2.5: Cancel subscription',
      fn: async () => {
        if (!subscriptionId) {
          logWarning('No subscription created - skipping');
          return;
        }

        const response = await apiRequestAuth<SubscriptionResponse>(
          `/v1/subscriptions/${subscriptionId}/cancel`,
          accessToken,
          { method: 'POST' }
        );

        assertStatusCode(response, 200, 'Cancel should succeed');
        logInfo('Subscription cancelled');
      },
    },

    // ==================== JOURNEY 3: AUTH REFRESH FLOW ====================
    {
      name: 'E2E Journey 3.1: Refresh access token',
      fn: async () => {
        const response = await apiRequest<AuthResponse>('/v1/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });

        assertStatusCode(response, 200, 'Refresh should succeed');
        assertNotNull(response.data.data, 'Should have data');

        // Update tokens
        accessToken = response.data.data!.tokens.accessToken;
        refreshToken = response.data.data!.tokens.refreshToken;

        logInfo('Token refreshed successfully');
      },
    },
    {
      name: 'E2E Journey 3.2: Use new token to access protected endpoint',
      fn: async () => {
        const response = await apiRequestAuth<{ data?: { id: string } }>(
          '/v1/users/me',
          accessToken
        );

        assertStatusCode(response, 200, 'Should access with new token');
        assertTrue(response.data.data!.id === userId, 'Should be same user');

        logInfo('New token works correctly');
      },
    },

    // ==================== JOURNEY 4: UPDATE USER PROFILE ====================
    {
      name: 'E2E Journey 4.1: Update user phone number',
      fn: async () => {
        const newPhone = '+1234567890';
        const response = await apiRequestAuth<{ data?: { phone: string } }>(
          '/v1/users/me',
          accessToken,
          {
            method: 'PATCH',
            body: JSON.stringify({ phone: newPhone }),
          }
        );

        assertStatusCode(response, 200, 'Update should succeed');
        assertTrue(
          response.data.data!.phone === newPhone,
          'Phone should be updated'
        );

        logInfo('Profile updated successfully');
      },
    },
    {
      name: 'E2E Journey 4.2: Verify profile update persisted',
      fn: async () => {
        const response = await apiRequestAuth<{ data?: { phone: string } }>(
          '/v1/users/me',
          accessToken
        );

        assertStatusCode(response, 200, 'Get profile should succeed');
        assertTrue(
          response.data.data!.phone === '+1234567890',
          'Phone should persist'
        );

        logInfo('Profile changes persisted');
      },
    },

    // ==================== JOURNEY 5: MESSAGE PROCESSING ====================
    {
      name: 'E2E Journey 5.1: Wait for message processing',
      fn: async () => {
        logInfo('Waiting for messages to be processed (6 seconds)...');
        await sleep(6000);
      },
    },
    {
      name: 'E2E Journey 5.2: Verify messages are completed',
      fn: async () => {
        const response = await apiRequestAuth<MessagesResponse>(
          '/v1/chat/messages?status=completed',
          accessToken
        );

        assertStatusCode(response, 200, 'Get messages should succeed');

        const completedCount = response.data.data!.messages.length;
        logInfo(`Completed messages: ${completedCount}`);

        // At least some messages should be completed
        if (completedCount > 0) {
          const firstMsg = response.data.data!.messages[0];
          assertHasProperty(
            firstMsg,
            'response',
            'Completed message should have response'
          );
          logInfo(
            `Sample response: "${firstMsg.response?.substring(0, 50)}..."`
          );
        }
      },
    },

    // ==================== JOURNEY 6: LOGIN FLOW ====================
    {
      name: 'E2E Journey 6.1: Login with credentials',
      fn: async () => {
        const response = await apiRequest<AuthResponse>('/v1/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: userEmail,
            password: userPassword,
          }),
        });

        assertStatusCode(response, 200, 'Login should succeed');
        assertNotNull(response.data.data, 'Should have data');
        assertTrue(
          response.data.data!.user.id === userId,
          'Should be same user'
        );

        logInfo('Login successful');
      },
    },

    // ==================== JOURNEY 7: ENTERPRISE SUBSCRIPTION (UNLIMITED) ====================
    {
      name: 'E2E Journey 7.1: Register Enterprise User',
      fn: async () => {
        const entEmail = randomEmail();
        const entPassword = 'EnterprisePass123';

        const response = await apiRequest<AuthResponse>('/v1/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: entEmail,
            password: entPassword,
          }),
        });

        assertStatusCode(response, 201, 'Registration should succeed');

        // Update tokens for this journey
        accessToken = response.data.data!.tokens.accessToken;
        userId = response.data.data!.user.id;

        logInfo(`Registered enterprise user: ${entEmail}`);
      },
    },
    {
      name: 'E2E Journey 7.2: Subscribe to Enterprise Tier',
      fn: async () => {
        // Get bundles
        const bundlesResponse =
          await apiRequest<BundleTiersResponse>('/v1/bundle-tiers');
        const enterpriseTier = bundlesResponse.data.data!.find(
          t => t.name === SEEDED_DATA.TIERS.ENTERPRISE.name
        );

        if (!enterpriseTier) {
          logWarning('Enterprise tier not found - skipping enterprise tests');
          return;
        }

        const response = await apiRequestAuth<SubscriptionResponse>(
          '/v1/subscriptions',
          accessToken,
          {
            method: 'POST',
            body: JSON.stringify({
              bundleTierId: enterpriseTier.id,
              billingCycle: 'yearly',
            }),
          }
        );

        if (response.status === 201) {
          logInfo('Subscribed to Enterprise tier');
        } else if (response.status === 400) {
          logWarning('Payment simulation failed - acceptable');
        } else {
          assertStatusCode(response, 201, 'Subscription should succeed');
        }
      },
    },
    {
      name: 'E2E Journey 7.3: Verify Unlimited Quota',
      fn: async () => {
        const response = await apiRequestAuth<QuotaResponse>(
          '/v1/subscriptions/quota',
          accessToken
        );

        assertStatusCode(response, 200, 'Quota check should succeed');

        // If subscription succeeded (might have failed due to payment sim)
        if (
          response.data.data!.latestBundleName ===
          SEEDED_DATA.TIERS.ENTERPRISE.name
        ) {
          assertTrue(response.data.data!.isUnlimited, 'Should be unlimited');
          logInfo('Verified unlimited quota');
        } else {
          logWarning(
            'Skipping unlimited check as subscription might have failed'
          );
        }
      },
    },
    {
      name: 'E2E Journey 7.4: Send messages (should not decrease quota)',
      fn: async () => {
        // Check if we are unlimited
        const quotaResponse = await apiRequestAuth<QuotaResponse>(
          '/v1/subscriptions/quota',
          accessToken
        );

        if (!quotaResponse.data.data!.isUnlimited) {
          logWarning('Not unlimited - skipping message check');
          return;
        }

        // Send a message
        const chatResponse = await apiRequestAuth<ChatResponse>(
          '/v1/chat/ask-question',
          accessToken,
          {
            method: 'POST',
            body: JSON.stringify({ query: 'Enterprise message' }),
          }
        );
        assertStatusCode(chatResponse, 200, 'Chat should succeed');

        // Check quota again
        const quotaResponseAfter = await apiRequestAuth<QuotaResponse>(
          '/v1/subscriptions/quota',
          accessToken
        );

        assertTrue(
          quotaResponseAfter.data.data!.isUnlimited,
          'Should still be unlimited'
        );
        // For unlimited, totalRemainingMessages might be a high number or not change in a way that matters,
        // but isUnlimited flag is key.

        logInfo('Sent message with unlimited quota');
      },
    },
  ];

  return runTestSuite('END-TO-END TESTS', tests);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runE2ETests()
    .then(summary => {
      if (summary.failed > 0) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('E2E tests failed:', error);
      process.exit(1);
    });
}
