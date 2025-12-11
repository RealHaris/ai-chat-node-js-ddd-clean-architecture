/**
 * User Module Tests
 * Tests for: Get Me, Update Me, Admin user management
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
  assertEqual,
  testStore,
  TestSummary,
  logInfo,
  logWarning,
} from './utils';

interface UserResponse {
  message?: string;
  error?: string;
  data?: {
    id: string;
    email: string;
    phone?: string;
    isAdmin: boolean;
    isFreeTier: boolean;
    monthlyMessageCount: number;
    createdAt: string;
    updatedAt: string;
  };
}

interface UsersListResponse {
  message?: string;
  error?: string;
  data?: Array<{
    id: string;
    email: string;
    isAdmin: boolean;
    isFreeTier: boolean;
  }>;
}

interface UserStatsResponse {
  message?: string;
  error?: string;
  data?: {
    userId: string;
    email: string;
    isFreeTier: boolean;
    monthlyMessageCount: number;
    activeSubscription?: {
      id: string;
      bundleTierName: string;
      maxMessages: number;
      expiresAt: string;
    };
    totalMessages: number;
    remainingMessages: number;
  };
}

// Setup helper: Ensure we have users from auth tests
async function ensureUsersExist(): Promise<void> {
  if (!testStore.regularUser) {
    // Create a regular user
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
      logInfo(`Created regular user for user tests: ${email}`);
    }
  }

  if (!testStore.adminUser) {
    // Create an admin user (will need manual DB update)
    const email = `admin_${randomEmail()}`;
    const password = 'AdminPassword123';

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
      testStore.adminUser = {
        id: response.data.data.user.id,
        email,
        password,
        accessToken: response.data.data.accessToken,
        refreshToken: response.data.data.refreshToken,
      };
      logInfo(`Created admin user for user tests: ${email}`);
      logWarning(
        'Note: You need to manually set isAdmin=true in the database for admin tests to pass'
      );
    }
  }
}

export async function runUserTests(): Promise<TestSummary> {
  // Ensure we have users before running tests
  await ensureUsersExist();

  const tests = [
    // ==================== GET ME TESTS ====================
    {
      name: 'Get Me - Without authentication',
      fn: async () => {
        const response = await apiRequest<UserResponse>('/v1/users/me');

        assertStatusCode(
          response,
          401,
          'Unauthenticated request should return 401'
        );
      },
    },
    {
      name: 'Get Me - With valid token',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<UserResponse>(
          '/v1/users/me',
          testStore.regularUser!.accessToken
        );

        assertStatusCode(response, 200, 'Should return 200');
        assertNotNull(response.data.data, 'Should have data');
        assertHasProperty(response.data.data!, 'id', 'Should have id');
        assertHasProperty(response.data.data!, 'email', 'Should have email');
        assertEqual(
          response.data.data!.email,
          testStore.regularUser!.email,
          'Email should match'
        );
      },
    },
    {
      name: 'Get Me - With invalid token',
      fn: async () => {
        const response = await apiRequestAuth<UserResponse>(
          '/v1/users/me',
          'invalid-token'
        );

        assertStatusCode(response, 401, 'Invalid token should return 401');
      },
    },
    {
      name: 'Get Me - With expired token format',
      fn: async () => {
        // This is a properly formatted but invalid JWT
        const fakeToken =
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
        const response = await apiRequestAuth<UserResponse>(
          '/v1/users/me',
          fakeToken
        );

        assertStatusCode(response, 401, 'Invalid JWT should return 401');
      },
    },

    // ==================== UPDATE ME TESTS ====================
    {
      name: 'Update Me - Without authentication',
      fn: async () => {
        const response = await apiRequest<UserResponse>('/v1/users/me', {
          method: 'PATCH',
          body: JSON.stringify({ phone: '+9876543210' }),
        });

        assertStatusCode(response, 401, 'Unauthenticated should return 401');
      },
    },
    {
      name: 'Update Me - Update phone number',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const newPhone = '+1122334455';
        const response = await apiRequestAuth<UserResponse>(
          '/v1/users/me',
          testStore.regularUser!.accessToken,
          {
            method: 'PATCH',
            body: JSON.stringify({ phone: newPhone }),
          }
        );

        assertStatusCode(response, 200, 'Should return 200');
        assertNotNull(response.data.data, 'Should have data');
        assertEqual(
          response.data.data!.phone,
          newPhone,
          'Phone should be updated'
        );
      },
    },
    {
      name: 'Update Me - Empty body (should be ok)',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<UserResponse>(
          '/v1/users/me',
          testStore.regularUser!.accessToken,
          {
            method: 'PATCH',
            body: JSON.stringify({}),
          }
        );

        // Empty body should either be 200 (no changes) or 400 (validation error)
        assertTrue(
          response.status === 200 || response.status === 400,
          'Empty body should return 200 or 400'
        );
      },
    },
    {
      name: 'Update Me - Cannot update email (should be ignored or error)',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<UserResponse>(
          '/v1/users/me',
          testStore.regularUser!.accessToken,
          {
            method: 'PATCH',
            body: JSON.stringify({ email: 'newemail@example.com' }),
          }
        );

        // Email change should either be ignored (200) or forbidden (400/403)
        assertTrue(
          response.status === 200 ||
            response.status === 400 ||
            response.status === 403,
          'Email change should be handled appropriately'
        );

        // If 200, verify email wasn't changed
        if (response.status === 200 && response.data.data) {
          assertEqual(
            response.data.data.email,
            testStore.regularUser!.email,
            'Email should not change'
          );
        }
      },
    },

    // ==================== ADMIN: GET ALL USERS ====================
    {
      name: 'Admin Get All Users - Without authentication',
      fn: async () => {
        const response = await apiRequest<UsersListResponse>('/v1/users');

        assertStatusCode(response, 401, 'Unauthenticated should return 401');
      },
    },
    {
      name: 'Admin Get All Users - Non-admin user',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<UsersListResponse>(
          '/v1/users',
          testStore.regularUser!.accessToken
        );

        assertStatusCode(response, 403, 'Non-admin should get 403');
      },
    },
    {
      name: 'Admin Get All Users - With admin token',
      fn: async () => {
        assertNotNull(testStore.adminUser, 'Admin user should exist');

        const response = await apiRequestAuth<UsersListResponse>(
          '/v1/users',
          testStore.adminUser!.accessToken
        );

        // Will be 403 if adminUser is not actually admin in DB
        if (response.status === 403) {
          logWarning(
            'Admin user is not set as admin in DB - skipping assertion'
          );
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

    // ==================== ADMIN: GET USER BY ID ====================
    {
      name: 'Admin Get User By ID - Without authentication',
      fn: async () => {
        const response = await apiRequest<UserResponse>(
          `/v1/users/${testStore.regularUser?.id || 'test-id'}`
        );

        assertStatusCode(response, 401, 'Unauthenticated should return 401');
      },
    },
    {
      name: 'Admin Get User By ID - Non-admin user',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<UserResponse>(
          `/v1/users/${testStore.regularUser!.id}`,
          testStore.regularUser!.accessToken
        );

        assertStatusCode(response, 403, 'Non-admin should get 403');
      },
    },
    {
      name: 'Admin Get User By ID - Invalid UUID',
      fn: async () => {
        assertNotNull(testStore.adminUser, 'Admin user should exist');

        const response = await apiRequestAuth<UserResponse>(
          '/v1/users/invalid-uuid',
          testStore.adminUser!.accessToken
        );

        // Should be 400 for invalid format or 403 if not admin
        assertTrue(
          response.status === 400 || response.status === 403,
          'Invalid UUID should return 400 or 403'
        );
      },
    },
    {
      name: 'Admin Get User By ID - Non-existent user',
      fn: async () => {
        assertNotNull(testStore.adminUser, 'Admin user should exist');

        const response = await apiRequestAuth<UserResponse>(
          '/v1/users/00000000-0000-0000-0000-000000000000',
          testStore.adminUser!.accessToken
        );

        // Should be 404 for not found or 403 if not admin
        assertTrue(
          response.status === 404 || response.status === 403,
          'Non-existent user should return 404 or 403'
        );
      },
    },

    // ==================== ADMIN: GET USER STATS ====================
    {
      name: 'Admin Get User Stats - Without authentication',
      fn: async () => {
        const response = await apiRequest<UserStatsResponse>(
          `/v1/users/get-user-stats/${testStore.regularUser?.id || 'test-id'}`
        );

        assertStatusCode(response, 401, 'Unauthenticated should return 401');
      },
    },
    {
      name: 'Admin Get User Stats - Non-admin user',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<UserStatsResponse>(
          `/v1/users/get-user-stats/${testStore.regularUser!.id}`,
          testStore.regularUser!.accessToken
        );

        assertStatusCode(response, 403, 'Non-admin should get 403');
      },
    },
    {
      name: 'Admin Get User Stats - Valid request',
      fn: async () => {
        assertNotNull(testStore.adminUser, 'Admin user should exist');
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<UserStatsResponse>(
          `/v1/users/get-user-stats/${testStore.regularUser!.id}`,
          testStore.adminUser!.accessToken
        );

        // Will be 403 if adminUser is not actually admin in DB
        if (response.status === 403) {
          logWarning(
            'Admin user is not set as admin in DB - skipping assertion'
          );
          return;
        }

        assertStatusCode(response, 200, 'Admin should get 200');
        assertNotNull(response.data.data, 'Should have stats data');
      },
    },

    // ==================== ADMIN: UPDATE USER ====================
    {
      name: 'Admin Update User - Without authentication',
      fn: async () => {
        const response = await apiRequest<UserResponse>(
          `/v1/users/${testStore.regularUser?.id || 'test-id'}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ phone: '+0000000000' }),
          }
        );

        assertStatusCode(response, 401, 'Unauthenticated should return 401');
      },
    },
    {
      name: 'Admin Update User - Non-admin user',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<UserResponse>(
          `/v1/users/${testStore.regularUser!.id}`,
          testStore.regularUser!.accessToken,
          {
            method: 'PATCH',
            body: JSON.stringify({ phone: '+0000000000' }),
          }
        );

        assertStatusCode(response, 403, 'Non-admin should get 403');
      },
    },

    // ==================== ADMIN: DELETE USER ====================
    {
      name: 'Admin Delete User - Without authentication',
      fn: async () => {
        const response = await apiRequest<{ message?: string }>(
          `/v1/users/${testStore.regularUser?.id || 'test-id'}`,
          { method: 'DELETE' }
        );

        assertStatusCode(response, 401, 'Unauthenticated should return 401');
      },
    },
    {
      name: 'Admin Delete User - Non-admin user',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<{ message?: string }>(
          `/v1/users/${testStore.regularUser!.id}`,
          testStore.regularUser!.accessToken,
          { method: 'DELETE' }
        );

        assertStatusCode(response, 403, 'Non-admin should get 403');
      },
    },
    {
      name: 'Admin Delete User - Invalid UUID',
      fn: async () => {
        assertNotNull(testStore.adminUser, 'Admin user should exist');

        const response = await apiRequestAuth<{ message?: string }>(
          '/v1/users/invalid-uuid',
          testStore.adminUser!.accessToken,
          { method: 'DELETE' }
        );

        // Should be 400 for invalid format or 403 if not admin
        assertTrue(
          response.status === 400 || response.status === 403,
          'Invalid UUID should return 400 or 403'
        );
      },
    },
  ];

  return runTestSuite('USER MODULE TESTS', tests);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runUserTests()
    .then(summary => {
      if (summary.failed > 0) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('User tests failed:', error);
      process.exit(1);
    });
}
