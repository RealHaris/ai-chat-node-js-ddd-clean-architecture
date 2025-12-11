/**
 * Bundle Tier Module Tests
 * Tests for: Get All (Public), Get By ID (Public), Admin CRUD
 */

import {
  apiRequest,
  apiRequestAuth,
  randomString,
  runTestSuite,
  assertStatusCode,
  assertHasProperty,
  assertNotNull,
  assertTrue,
  assertEqual,
  testStore,
  TestSummary,
  logInfo,
  logWarning,
  randomEmail,
} from './utils';

interface BundleTierResponse {
  message?: string;
  error?: string;
  data?: {
    id: string;
    name: string;
    maxMessages: number;
    priceMonthly: string;
    priceYearly: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

interface BundleTiersListResponse {
  message?: string;
  error?: string;
  data?: Array<{
    id: string;
    name: string;
    maxMessages: number;
    priceMonthly: string;
    priceYearly: string;
    isActive: boolean;
  }>;
}

// Setup helper: Ensure we have users
async function ensureUsersExist(): Promise<void> {
  if (!testStore.regularUser) {
    const email = randomEmail();
    const password = 'TestPassword123';

    const response = await apiRequest<{
      data?: {
        accessToken: string;
        refreshToken: string;
        user: { id: string; email: string };
      };
    }>('/auth/register', {
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
      logInfo(`Created regular user for bundle tests: ${email}`);
    }
  }

  if (!testStore.adminUser) {
    const email = `admin_${randomEmail()}`;
    const password = 'AdminPassword123';

    const response = await apiRequest<{
      data?: {
        accessToken: string;
        refreshToken: string;
        user: { id: string; email: string };
      };
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.status === 201 && response.data.data) {
      testStore.adminUser = {
        id: response.data.data.user.id,
        email,
        password,
        accessToken: response.data.data.accessToken,
        refreshToken: response.data.data.refreshToken,
      };
      logInfo(`Created admin user for bundle tests: ${email}`);
      logWarning(
        'Note: You need to manually set isAdmin=true in the database for admin tests to pass'
      );
    }
  }
}

// Track created bundle for cleanup
let createdBundleId: string | null = null;

export async function runBundleTierTests(): Promise<TestSummary> {
  await ensureUsersExist();

  const tests = [
    // ==================== PUBLIC: GET ALL BUNDLE TIERS ====================
    {
      name: 'Get All Bundle Tiers - Public (no auth required)',
      fn: async () => {
        const response =
          await apiRequest<BundleTiersListResponse>('/bundle-tiers');

        assertStatusCode(response, 200, 'Should return 200');
        assertNotNull(response.data.data, 'Should have data');
        assertTrue(
          Array.isArray(response.data.data),
          'Data should be an array'
        );

        // Store bundle tiers for later tests
        if (response.data.data && response.data.data.length > 0) {
          testStore.bundleTiers = response.data.data.map(bt => ({
            id: bt.id,
            name: bt.name,
            maxMessages: bt.maxMessages,
            priceMonthly: bt.priceMonthly,
            priceYearly: bt.priceYearly,
          }));
          logInfo(`Found ${response.data.data.length} bundle tiers`);
        }
      },
    },
    {
      name: 'Get All Bundle Tiers - Only returns active bundles',
      fn: async () => {
        const response =
          await apiRequest<BundleTiersListResponse>('/bundle-tiers');

        assertStatusCode(response, 200, 'Should return 200');

        // All returned bundles should be active
        if (response.data.data) {
          for (const bundle of response.data.data) {
            assertTrue(
              bundle.isActive,
              `Bundle ${bundle.name} should be active`
            );
          }
        }
      },
    },

    // ==================== PUBLIC: GET BUNDLE TIER BY ID ====================
    {
      name: 'Get Bundle Tier By ID - Valid ID',
      fn: async () => {
        if (testStore.bundleTiers.length === 0) {
          logWarning('No bundle tiers available - skipping test');
          return;
        }

        const bundleId = testStore.bundleTiers[0].id;
        const response = await apiRequest<BundleTierResponse>(
          `/bundle-tiers/${bundleId}`
        );

        assertStatusCode(response, 200, 'Should return 200');
        assertNotNull(response.data.data, 'Should have data');
        assertEqual(
          response.data.data!.id,
          bundleId,
          'ID should match requested'
        );
      },
    },
    {
      name: 'Get Bundle Tier By ID - Invalid UUID format',
      fn: async () => {
        const response = await apiRequest<BundleTierResponse>(
          '/bundle-tiers/invalid-uuid'
        );

        assertStatusCode(response, 400, 'Invalid UUID should return 400');
      },
    },
    {
      name: 'Get Bundle Tier By ID - Non-existent ID',
      fn: async () => {
        const response = await apiRequest<BundleTierResponse>(
          '/bundle-tiers/00000000-0000-0000-0000-000000000000'
        );

        assertStatusCode(response, 404, 'Non-existent should return 404');
      },
    },

    // ==================== ADMIN: GET ALL (INCLUDING INACTIVE) ====================
    {
      name: 'Admin Get All Bundle Tiers - Without auth',
      fn: async () => {
        const response = await apiRequest<BundleTiersListResponse>(
          '/bundle-tiers/admin/all'
        );

        assertStatusCode(response, 401, 'Unauthenticated should return 401');
      },
    },
    {
      name: 'Admin Get All Bundle Tiers - Non-admin user',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<BundleTiersListResponse>(
          '/bundle-tiers/admin/all',
          testStore.regularUser!.accessToken
        );

        assertStatusCode(response, 403, 'Non-admin should get 403');
      },
    },
    {
      name: 'Admin Get All Bundle Tiers - With admin token',
      fn: async () => {
        assertNotNull(testStore.adminUser, 'Admin user should exist');

        const response = await apiRequestAuth<BundleTiersListResponse>(
          '/bundle-tiers/admin/all',
          testStore.adminUser!.accessToken
        );

        if (response.status === 403) {
          logWarning('Admin user is not set as admin in DB - skipping');
          return;
        }

        assertStatusCode(response, 200, 'Admin should get 200');
        assertNotNull(response.data.data, 'Should have data');
        assertTrue(
          Array.isArray(response.data.data),
          'Data should be an array'
        );
      },
    },

    // ==================== ADMIN: CREATE BUNDLE TIER ====================
    {
      name: 'Admin Create Bundle Tier - Without auth',
      fn: async () => {
        const response = await apiRequest<BundleTierResponse>('/bundle-tiers', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Test Bundle',
            maxMessages: 100,
            priceMonthly: '9.99',
            priceYearly: '99.99',
          }),
        });

        assertStatusCode(response, 401, 'Unauthenticated should return 401');
      },
    },
    {
      name: 'Admin Create Bundle Tier - Non-admin user',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<BundleTierResponse>(
          '/bundle-tiers',
          testStore.regularUser!.accessToken,
          {
            method: 'POST',
            body: JSON.stringify({
              name: 'Test Bundle',
              maxMessages: 100,
              priceMonthly: '9.99',
              priceYearly: '99.99',
            }),
          }
        );

        assertStatusCode(response, 403, 'Non-admin should get 403');
      },
    },
    {
      name: 'Admin Create Bundle Tier - Valid request',
      fn: async () => {
        assertNotNull(testStore.adminUser, 'Admin user should exist');

        const bundleName = `Test_${randomString(6)}`;
        const response = await apiRequestAuth<BundleTierResponse>(
          '/bundle-tiers',
          testStore.adminUser!.accessToken,
          {
            method: 'POST',
            body: JSON.stringify({
              name: bundleName,
              maxMessages: 100,
              priceMonthly: '9.99',
              priceYearly: '99.99',
            }),
          }
        );

        if (response.status === 403) {
          logWarning('Admin user is not set as admin in DB - skipping');
          return;
        }

        assertStatusCode(response, 201, 'Should return 201');
        assertNotNull(response.data.data, 'Should have data');
        assertEqual(response.data.data!.name, bundleName, 'Name should match');
        assertEqual(
          response.data.data!.maxMessages,
          100,
          'maxMessages should match'
        );

        // Store for cleanup
        createdBundleId = response.data.data!.id;
        logInfo(`Created bundle tier: ${bundleName} (${createdBundleId})`);
      },
    },
    {
      name: 'Admin Create Bundle Tier - Missing required fields',
      fn: async () => {
        assertNotNull(testStore.adminUser, 'Admin user should exist');

        const response = await apiRequestAuth<BundleTierResponse>(
          '/bundle-tiers',
          testStore.adminUser!.accessToken,
          {
            method: 'POST',
            body: JSON.stringify({
              name: 'Incomplete Bundle',
              // Missing maxMessages, priceMonthly, priceYearly
            }),
          }
        );

        // Should be 400 for validation error or 403 if not admin
        assertTrue(
          response.status === 400 || response.status === 403,
          'Missing fields should return 400 or 403'
        );
      },
    },
    {
      name: 'Admin Create Bundle Tier - Unlimited messages (-1)',
      fn: async () => {
        assertNotNull(testStore.adminUser, 'Admin user should exist');

        const bundleName = `Unlimited_${randomString(6)}`;
        const response = await apiRequestAuth<BundleTierResponse>(
          '/bundle-tiers',
          testStore.adminUser!.accessToken,
          {
            method: 'POST',
            body: JSON.stringify({
              name: bundleName,
              maxMessages: -1, // Unlimited
              priceMonthly: '49.99',
              priceYearly: '499.99',
            }),
          }
        );

        if (response.status === 403) {
          logWarning('Admin user is not set as admin in DB - skipping');
          return;
        }

        assertStatusCode(response, 201, 'Should return 201');
        assertEqual(
          response.data.data!.maxMessages,
          -1,
          'maxMessages should be -1 for unlimited'
        );
      },
    },

    // ==================== ADMIN: UPDATE BUNDLE TIER ====================
    {
      name: 'Admin Update Bundle Tier - Without auth',
      fn: async () => {
        const bundleId =
          createdBundleId ||
          testStore.bundleTiers[0]?.id ||
          '00000000-0000-0000-0000-000000000000';

        const response = await apiRequest<BundleTierResponse>(
          `/bundle-tiers/${bundleId}`,
          {
            method: 'PUT',
            body: JSON.stringify({ name: 'Updated Name' }),
          }
        );

        assertStatusCode(response, 401, 'Unauthenticated should return 401');
      },
    },
    {
      name: 'Admin Update Bundle Tier - Non-admin user',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const bundleId =
          createdBundleId ||
          testStore.bundleTiers[0]?.id ||
          '00000000-0000-0000-0000-000000000000';

        const response = await apiRequestAuth<BundleTierResponse>(
          `/bundle-tiers/${bundleId}`,
          testStore.regularUser!.accessToken,
          {
            method: 'PUT',
            body: JSON.stringify({ name: 'Updated Name' }),
          }
        );

        assertStatusCode(response, 403, 'Non-admin should get 403');
      },
    },
    {
      name: 'Admin Update Bundle Tier - Valid update',
      fn: async () => {
        assertNotNull(testStore.adminUser, 'Admin user should exist');

        if (!createdBundleId && testStore.bundleTiers.length === 0) {
          logWarning('No bundle tier to update - skipping');
          return;
        }

        const bundleId = createdBundleId || testStore.bundleTiers[0].id;
        const newName = `Updated_${randomString(6)}`;

        const response = await apiRequestAuth<BundleTierResponse>(
          `/bundle-tiers/${bundleId}`,
          testStore.adminUser!.accessToken,
          {
            method: 'PUT',
            body: JSON.stringify({ name: newName }),
          }
        );

        if (response.status === 403) {
          logWarning('Admin user is not set as admin in DB - skipping');
          return;
        }

        assertStatusCode(response, 200, 'Should return 200');
        assertEqual(
          response.data.data!.name,
          newName,
          'Name should be updated'
        );
      },
    },
    {
      name: 'Admin Update Bundle Tier - Non-existent ID',
      fn: async () => {
        assertNotNull(testStore.adminUser, 'Admin user should exist');

        const response = await apiRequestAuth<BundleTierResponse>(
          '/bundle-tiers/00000000-0000-0000-0000-000000000000',
          testStore.adminUser!.accessToken,
          {
            method: 'PUT',
            body: JSON.stringify({ name: 'Updated Name' }),
          }
        );

        // Should be 404 for not found or 403 if not admin
        assertTrue(
          response.status === 404 || response.status === 403,
          'Non-existent should return 404 or 403'
        );
      },
    },

    // ==================== ADMIN: DELETE BUNDLE TIER (SOFT DELETE) ====================
    {
      name: 'Admin Delete Bundle Tier - Without auth',
      fn: async () => {
        const bundleId =
          createdBundleId ||
          testStore.bundleTiers[0]?.id ||
          '00000000-0000-0000-0000-000000000000';

        const response = await apiRequest<{ message?: string }>(
          `/bundle-tiers/${bundleId}`,
          { method: 'DELETE' }
        );

        assertStatusCode(response, 401, 'Unauthenticated should return 401');
      },
    },
    {
      name: 'Admin Delete Bundle Tier - Non-admin user',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const bundleId =
          createdBundleId ||
          testStore.bundleTiers[0]?.id ||
          '00000000-0000-0000-0000-000000000000';

        const response = await apiRequestAuth<{ message?: string }>(
          `/bundle-tiers/${bundleId}`,
          testStore.regularUser!.accessToken,
          { method: 'DELETE' }
        );

        assertStatusCode(response, 403, 'Non-admin should get 403');
      },
    },
    {
      name: 'Admin Delete Bundle Tier - Valid delete (soft delete)',
      fn: async () => {
        assertNotNull(testStore.adminUser, 'Admin user should exist');

        if (!createdBundleId) {
          logWarning('No created bundle to delete - skipping');
          return;
        }

        const response = await apiRequestAuth<{ message?: string }>(
          `/bundle-tiers/${createdBundleId}`,
          testStore.adminUser!.accessToken,
          { method: 'DELETE' }
        );

        if (response.status === 403) {
          logWarning('Admin user is not set as admin in DB - skipping');
          return;
        }

        assertStatusCode(response, 200, 'Should return 200');
        logInfo(`Soft deleted bundle tier: ${createdBundleId}`);
      },
    },
    {
      name: 'Admin Delete Bundle Tier - Non-existent ID',
      fn: async () => {
        assertNotNull(testStore.adminUser, 'Admin user should exist');

        const response = await apiRequestAuth<{ message?: string }>(
          '/bundle-tiers/00000000-0000-0000-0000-000000000000',
          testStore.adminUser!.accessToken,
          { method: 'DELETE' }
        );

        // Should be 404 for not found or 403 if not admin
        assertTrue(
          response.status === 404 || response.status === 403,
          'Non-existent should return 404 or 403'
        );
      },
    },
  ];

  return runTestSuite('BUNDLE TIER MODULE TESTS', tests);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBundleTierTests()
    .then(summary => {
      if (summary.failed > 0) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Bundle tier tests failed:', error);
      process.exit(1);
    });
}
