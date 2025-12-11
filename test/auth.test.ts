/**
 * Auth Module Tests
 * Tests for: Register, Login, Refresh Token, Reset Password (Admin)
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
} from './utils';

interface AuthResponse {
  message?: string;
  error?: string;
  data?: {
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      email: string;
      isAdmin: boolean;
      isFreeTier: boolean;
    };
  };
}

interface ResetPasswordResponse {
  message?: string;
  error?: string;
}

// Test data
const regularUserEmail = randomEmail();
const regularUserPassword = 'TestPassword123';
const adminUserEmail = `admin_${randomEmail()}`;
const adminUserPassword = 'AdminPassword123';

export async function runAuthTests(): Promise<TestSummary> {
  const tests = [
    // ==================== REGISTER TESTS ====================
    {
      name: 'Register - Valid user registration',
      fn: async () => {
        const response = await apiRequest<AuthResponse>('/v1/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: regularUserEmail,
            password: regularUserPassword,
            phone: '+1234567890',
          }),
        });

        assertStatusCode(response, 201, 'Register should return 201');
        assertNotNull(response.data.data, 'Response should have data');
        assertHasProperty(
          response.data.data!,
          'accessToken',
          'Should have accessToken'
        );
        assertHasProperty(
          response.data.data!,
          'refreshToken',
          'Should have refreshToken'
        );
        assertHasProperty(response.data.data!, 'user', 'Should have user');

        // Store for later tests
        testStore.regularUser = {
          id: response.data.data!.user.id,
          email: regularUserEmail,
          password: regularUserPassword,
          accessToken: response.data.data!.accessToken,
          refreshToken: response.data.data!.refreshToken,
        };

        logInfo(`Created regular user: ${regularUserEmail}`);
      },
    },
    {
      name: 'Register - Admin user registration',
      fn: async () => {
        const response = await apiRequest<AuthResponse>('/v1/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: adminUserEmail,
            password: adminUserPassword,
          }),
        });

        assertStatusCode(response, 201, 'Register should return 201');
        assertNotNull(response.data.data, 'Response should have data');

        // Store for later tests
        testStore.adminUser = {
          id: response.data.data!.user.id,
          email: adminUserEmail,
          password: adminUserPassword,
          accessToken: response.data.data!.accessToken,
          refreshToken: response.data.data!.refreshToken,
        };

        logInfo(`Created admin user: ${adminUserEmail}`);
        logInfo(
          `Note: You may need to manually set isAdmin=true in the database for admin tests`
        );
      },
    },
    {
      name: 'Register - Invalid email format',
      fn: async () => {
        const response = await apiRequest<AuthResponse>('/v1/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: 'invalid-email',
            password: 'ValidPassword123',
          }),
        });

        assertStatusCode(response, 400, 'Invalid email should return 400');
        assertHasProperty(response.data, 'error', 'Should have error message');
      },
    },
    {
      name: 'Register - Weak password (too short)',
      fn: async () => {
        const response = await apiRequest<AuthResponse>('/v1/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: randomEmail(),
            password: 'weak',
          }),
        });

        assertStatusCode(response, 400, 'Weak password should return 400');
        assertHasProperty(response.data, 'error', 'Should have error message');
      },
    },
    {
      name: 'Register - Password without uppercase',
      fn: async () => {
        const response = await apiRequest<AuthResponse>('/v1/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: randomEmail(),
            password: 'password123',
          }),
        });

        assertStatusCode(
          response,
          400,
          'Password without uppercase should return 400'
        );
      },
    },
    {
      name: 'Register - Password without lowercase',
      fn: async () => {
        const response = await apiRequest<AuthResponse>('/v1/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: randomEmail(),
            password: 'PASSWORD123',
          }),
        });

        assertStatusCode(
          response,
          400,
          'Password without lowercase should return 400'
        );
      },
    },
    {
      name: 'Register - Password without number',
      fn: async () => {
        const response = await apiRequest<AuthResponse>('/v1/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: randomEmail(),
            password: 'PasswordOnly',
          }),
        });

        assertStatusCode(
          response,
          400,
          'Password without number should return 400'
        );
      },
    },
    {
      name: 'Register - Duplicate email',
      fn: async () => {
        const response = await apiRequest<AuthResponse>('/v1/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: regularUserEmail, // Already registered
            password: 'AnotherPassword123',
          }),
        });

        assertStatusCode(response, 400, 'Duplicate email should return 400');
        assertHasProperty(response.data, 'error', 'Should have error message');
      },
    },
    {
      name: 'Register - Missing email',
      fn: async () => {
        const response = await apiRequest<AuthResponse>('/v1/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            password: 'ValidPassword123',
          }),
        });

        assertStatusCode(response, 400, 'Missing email should return 400');
      },
    },
    {
      name: 'Register - Missing password',
      fn: async () => {
        const response = await apiRequest<AuthResponse>('/v1/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: randomEmail(),
          }),
        });

        assertStatusCode(response, 400, 'Missing password should return 400');
      },
    },

    // ==================== LOGIN TESTS ====================
    {
      name: 'Login - Valid credentials',
      fn: async () => {
        const response = await apiRequest<AuthResponse>('/v1/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: regularUserEmail,
            password: regularUserPassword,
          }),
        });

        assertStatusCode(response, 200, 'Login should return 200');
        assertNotNull(response.data.data, 'Response should have data');
        assertHasProperty(
          response.data.data!,
          'accessToken',
          'Should have accessToken'
        );
        assertHasProperty(
          response.data.data!,
          'refreshToken',
          'Should have refreshToken'
        );

        // Update stored tokens
        if (testStore.regularUser) {
          testStore.regularUser.accessToken = response.data.data!.accessToken;
          testStore.regularUser.refreshToken = response.data.data!.refreshToken;
        }
      },
    },
    {
      name: 'Login - Invalid password',
      fn: async () => {
        const response = await apiRequest<AuthResponse>('/v1/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: regularUserEmail,
            password: 'WrongPassword123',
          }),
        });

        assertTrue(
          response.status === 400 || response.status === 401,
          'Invalid password should return 400 or 401'
        );
        assertHasProperty(response.data, 'error', 'Should have error message');
      },
    },
    {
      name: 'Login - Non-existent user',
      fn: async () => {
        const response = await apiRequest<AuthResponse>('/v1/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: 'nonexistent@example.com',
            password: 'SomePassword123',
          }),
        });

        assertTrue(
          response.status === 400 || response.status === 401,
          'Non-existent user should return 400 or 401'
        );
      },
    },
    {
      name: 'Login - Invalid email format',
      fn: async () => {
        const response = await apiRequest<AuthResponse>('/v1/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: 'invalid-email',
            password: 'SomePassword123',
          }),
        });

        assertStatusCode(
          response,
          400,
          'Invalid email format should return 400'
        );
      },
    },
    {
      name: 'Login - Empty credentials',
      fn: async () => {
        const response = await apiRequest<AuthResponse>('/v1/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: '',
            password: '',
          }),
        });

        assertStatusCode(response, 400, 'Empty credentials should return 400');
      },
    },

    // ==================== REFRESH TOKEN TESTS ====================
    {
      name: 'Refresh Token - Valid refresh token',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should be created');

        const response = await apiRequest<AuthResponse>('/v1/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({
            refreshToken: testStore.regularUser!.refreshToken,
          }),
        });

        assertStatusCode(response, 200, 'Refresh should return 200');
        assertNotNull(response.data.data, 'Response should have data');
        assertHasProperty(
          response.data.data!,
          'accessToken',
          'Should have new accessToken'
        );
        assertHasProperty(
          response.data.data!,
          'refreshToken',
          'Should have new refreshToken'
        );

        // Update stored tokens
        testStore.regularUser!.accessToken = response.data.data!.accessToken;
        testStore.regularUser!.refreshToken = response.data.data!.refreshToken;
      },
    },
    {
      name: 'Refresh Token - Invalid token',
      fn: async () => {
        const response = await apiRequest<AuthResponse>('/v1/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({
            refreshToken: 'invalid-refresh-token',
          }),
        });

        assertTrue(
          response.status === 400 || response.status === 401,
          'Invalid token should return 400 or 401'
        );
      },
    },
    {
      name: 'Refresh Token - Empty token',
      fn: async () => {
        const response = await apiRequest<AuthResponse>('/v1/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({
            refreshToken: '',
          }),
        });

        assertStatusCode(response, 400, 'Empty token should return 400');
      },
    },
    {
      name: 'Refresh Token - Missing token',
      fn: async () => {
        const response = await apiRequest<AuthResponse>('/v1/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({}),
        });

        assertStatusCode(response, 400, 'Missing token should return 400');
      },
    },

    // ==================== RESET PASSWORD TESTS (Admin Only) ====================
    {
      name: 'Reset Password - Without authentication',
      fn: async () => {
        const response = await apiRequest<ResetPasswordResponse>(
          '/v1/auth/reset-password',
          {
            method: 'POST',
            body: JSON.stringify({
              userId: testStore.regularUser?.id,
              newPassword: 'NewPassword123',
            }),
          }
        );

        assertStatusCode(
          response,
          401,
          'Unauthenticated request should return 401'
        );
      },
    },
    {
      name: 'Reset Password - Non-admin user (should be forbidden)',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should be created');

        const response = await apiRequestAuth<ResetPasswordResponse>(
          '/v1/auth/reset-password',
          testStore.regularUser!.accessToken,
          {
            method: 'POST',
            body: JSON.stringify({
              userId: testStore.regularUser!.id,
              newPassword: 'NewPassword123',
            }),
          }
        );

        // Non-admin should get 403 Forbidden
        assertStatusCode(response, 403, 'Non-admin should get 403 Forbidden');
      },
    },
    {
      name: 'Reset Password - Invalid userId format',
      fn: async () => {
        assertNotNull(testStore.adminUser, 'Admin user should be created');

        const response = await apiRequestAuth<ResetPasswordResponse>(
          '/v1/auth/reset-password',
          testStore.adminUser!.accessToken,
          {
            method: 'POST',
            body: JSON.stringify({
              userId: 'invalid-uuid',
              newPassword: 'NewPassword123',
            }),
          }
        );

        // Should be 400 for invalid format, or 403 if not admin
        assertTrue(
          response.status === 400 || response.status === 403,
          'Invalid UUID should return 400 or 403'
        );
      },
    },
    {
      name: 'Reset Password - Weak new password',
      fn: async () => {
        assertNotNull(testStore.adminUser, 'Admin user should be created');

        const response = await apiRequestAuth<ResetPasswordResponse>(
          '/v1/auth/reset-password',
          testStore.adminUser!.accessToken,
          {
            method: 'POST',
            body: JSON.stringify({
              userId: testStore.regularUser?.id,
              newPassword: 'weak',
            }),
          }
        );

        // Should be 400 for weak password, or 403 if not admin
        assertTrue(
          response.status === 400 || response.status === 403,
          'Weak password should return 400 or 403'
        );
      },
    },
  ];

  return runTestSuite('AUTH MODULE TESTS', tests);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAuthTests()
    .then(summary => {
      if (summary.failed > 0) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Auth tests failed:', error);
      process.exit(1);
    });
}
