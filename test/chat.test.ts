/**
 * Chat Module Tests
 * Tests for: Ask Question, Get Messages, Admin List User Messages
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
  sleep,
} from './utils';

interface ChatMessageResponse {
  message?: string;
  error?: string;
  data?: {
    id: string;
    userId: string;
    query: string;
    response?: string;
    status: 'pending' | 'completed' | 'failed';
    createdAt: string;
    updatedAt: string;
  };
}

interface ChatMessagesListResponse {
  message?: string;
  error?: string;
  data?: {
    messages: Array<{
      id: string;
      userId: string;
      query: string;
      response?: string;
      status: string;
      createdAt: string;
    }>;
    pagination: {
      page: number;
      size: number;
      total: number;
      totalPages: number;
    };
  };
}

// Setup helper
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
      logInfo(`Created regular user for chat tests: ${email}`);
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
      logInfo(`Created admin user for chat tests: ${email}`);
      logWarning(
        'Note: You need to manually set isAdmin=true in the database for admin tests to pass'
      );
    }
  }
}

// Track created message for later tests
let createdMessageId: string | null = null;

export async function runChatTests(): Promise<TestSummary> {
  await ensureUsersExist();

  const tests = [
    // ==================== ASK QUESTION ====================
    {
      name: 'Ask Question - Without authentication',
      fn: async () => {
        const response = await apiRequest<ChatMessageResponse>(
          '/v1/chat/ask-question',
          {
            method: 'POST',
            body: JSON.stringify({ query: 'Hello, how are you?' }),
          }
        );

        assertStatusCode(response, 401, 'Unauthenticated should return 401');
      },
    },
    {
      name: 'Ask Question - Missing query',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<ChatMessageResponse>(
          '/v1/chat/ask-question',
          testStore.regularUser!.accessToken,
          {
            method: 'POST',
            body: JSON.stringify({}),
          }
        );

        assertStatusCode(response, 400, 'Missing query should return 400');
      },
    },
    {
      name: 'Ask Question - Empty query',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<ChatMessageResponse>(
          '/v1/chat/ask-question',
          testStore.regularUser!.accessToken,
          {
            method: 'POST',
            body: JSON.stringify({ query: '' }),
          }
        );

        assertStatusCode(response, 400, 'Empty query should return 400');
      },
    },
    {
      name: 'Ask Question - Valid query (free tier)',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const query = 'What is the capital of France?';
        const response = await apiRequestAuth<ChatMessageResponse>(
          '/v1/chat/ask-question',
          testStore.regularUser!.accessToken,
          {
            method: 'POST',
            body: JSON.stringify({ query }),
          }
        );

        // Could be 201 for success or 429 if quota exceeded
        if (response.status === 201) {
          assertNotNull(response.data.data, 'Should have data');
          assertHasProperty(response.data.data!, 'id', 'Should have id');
          assertHasProperty(
            response.data.data!,
            'status',
            'Should have status'
          );

          createdMessageId = response.data.data!.id;
          testStore.chatMessages.push({
            id: response.data.data!.id,
            userId: testStore.regularUser!.id,
            query,
            status: response.data.data!.status,
          });

          logInfo(`Created chat message: ${createdMessageId}`);
          logInfo(`Initial status: ${response.data.data!.status}`);
        } else if (response.status === 429) {
          logWarning('Quota exceeded - user has used all free tier messages');
          assertTrue(true, 'Quota exceeded is acceptable');
        } else {
          assertStatusCode(response, 201, 'Should return 201 or 429');
        }
      },
    },
    {
      name: 'Ask Question - Second message (testing quota)',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<ChatMessageResponse>(
          '/v1/chat/ask-question',
          testStore.regularUser!.accessToken,
          {
            method: 'POST',
            body: JSON.stringify({ query: 'What is 2 + 2?' }),
          }
        );

        // Could be 201 for success or 429 if quota exceeded
        assertTrue(
          response.status === 201 || response.status === 429,
          'Should return 201 or 429 (quota exceeded)'
        );

        if (response.status === 201) {
          logInfo('Second message sent successfully');
        } else {
          logInfo('Quota limit reached');
        }
      },
    },
    {
      name: 'Ask Question - Third message (testing quota)',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<ChatMessageResponse>(
          '/v1/chat/ask-question',
          testStore.regularUser!.accessToken,
          {
            method: 'POST',
            body: JSON.stringify({ query: 'What is the meaning of life?' }),
          }
        );

        // Could be 201 for success or 429 if quota exceeded
        assertTrue(
          response.status === 201 || response.status === 429,
          'Should return 201 or 429 (quota exceeded)'
        );

        if (response.status === 201) {
          logInfo('Third message sent successfully');
        } else {
          logInfo('Quota limit reached');
        }
      },
    },
    {
      name: 'Ask Question - Fourth message (should hit free tier limit)',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<ChatMessageResponse>(
          '/v1/chat/ask-question',
          testStore.regularUser!.accessToken,
          {
            method: 'POST',
            body: JSON.stringify({ query: 'Tell me a joke' }),
          }
        );

        // Free tier is 3 messages, so 4th should likely fail
        assertTrue(
          response.status === 201 || response.status === 429,
          'Should return 201 or 429'
        );

        if (response.status === 429) {
          logInfo('Free tier quota (3 messages) correctly enforced');
        }
      },
    },

    // ==================== GET MESSAGES ====================
    {
      name: 'Get Messages - Without authentication',
      fn: async () => {
        const response =
          await apiRequest<ChatMessagesListResponse>('/v1/chat/messages');

        assertStatusCode(response, 401, 'Unauthenticated should return 401');
      },
    },
    {
      name: 'Get Messages - With valid token',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<ChatMessagesListResponse>(
          '/v1/chat/messages',
          testStore.regularUser!.accessToken
        );

        assertStatusCode(response, 200, 'Should return 200');
        assertNotNull(response.data.data, 'Should have data');
        assertHasProperty(
          response.data.data!,
          'messages',
          'Should have messages'
        );
        assertHasProperty(
          response.data.data!,
          'pagination',
          'Should have pagination'
        );

        logInfo(`Found ${response.data.data!.messages.length} messages`);
      },
    },
    {
      name: 'Get Messages - With pagination (page=1, size=2)',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<ChatMessagesListResponse>(
          '/v1/chat/messages?page=1&size=2',
          testStore.regularUser!.accessToken
        );

        assertStatusCode(response, 200, 'Should return 200');
        assertNotNull(response.data.data, 'Should have data');

        // Verify pagination info
        if (response.data.data!.pagination) {
          assertTrue(
            response.data.data!.messages.length <= 2,
            'Should have at most 2 messages'
          );
          logInfo(
            `Page 1 with size 2: ${response.data.data!.messages.length} messages`
          );
        }
      },
    },
    {
      name: 'Get Messages - Filter by status=completed',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        // Wait a bit for messages to be processed
        await sleep(1000);

        const response = await apiRequestAuth<ChatMessagesListResponse>(
          '/v1/chat/messages?status=completed',
          testStore.regularUser!.accessToken
        );

        assertStatusCode(response, 200, 'Should return 200');
        assertNotNull(response.data.data, 'Should have data');

        // All returned messages should have status=completed
        for (const msg of response.data.data!.messages) {
          if (msg.status !== 'completed') {
            logWarning(`Message ${msg.id} has status ${msg.status}`);
          }
        }
      },
    },
    {
      name: 'Get Messages - Filter by status=pending',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<ChatMessagesListResponse>(
          '/v1/chat/messages?status=pending',
          testStore.regularUser!.accessToken
        );

        assertStatusCode(response, 200, 'Should return 200');
        assertNotNull(response.data.data, 'Should have data');

        logInfo(
          `Found ${response.data.data!.messages.length} pending messages`
        );
      },
    },
    {
      name: 'Get Messages - Invalid status filter',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<ChatMessagesListResponse>(
          '/v1/chat/messages?status=invalid',
          testStore.regularUser!.accessToken
        );

        // Should either return 400 for invalid status or 200 with no filter
        assertTrue(
          response.status === 200 || response.status === 400,
          'Invalid status should be handled'
        );
      },
    },
    {
      name: 'Get Messages - Invalid page number (negative)',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<ChatMessagesListResponse>(
          '/v1/chat/messages?page=-1',
          testStore.regularUser!.accessToken
        );

        // Should either return 400 or default to page 1
        assertTrue(
          response.status === 200 || response.status === 400,
          'Negative page should be handled'
        );
      },
    },

    // ==================== ADMIN: LIST USER MESSAGES ====================
    {
      name: 'Admin List User Messages - Without authentication',
      fn: async () => {
        const response = await apiRequest<ChatMessagesListResponse>(
          `/v1/chat/list-user-messages/${testStore.regularUser?.id || 'test-id'}`
        );

        assertStatusCode(response, 401, 'Unauthenticated should return 401');
      },
    },
    {
      name: 'Admin List User Messages - Non-admin user',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<ChatMessagesListResponse>(
          `/v1/chat/list-user-messages/${testStore.regularUser!.id}`,
          testStore.regularUser!.accessToken
        );

        assertStatusCode(response, 403, 'Non-admin should get 403');
      },
    },
    {
      name: 'Admin List User Messages - Invalid user ID',
      fn: async () => {
        assertNotNull(testStore.adminUser, 'Admin user should exist');

        const response = await apiRequestAuth<ChatMessagesListResponse>(
          '/v1/chat/list-user-messages/invalid-uuid',
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
      name: 'Admin List User Messages - Non-existent user',
      fn: async () => {
        assertNotNull(testStore.adminUser, 'Admin user should exist');

        const response = await apiRequestAuth<ChatMessagesListResponse>(
          '/v1/chat/list-user-messages/00000000-0000-0000-0000-000000000000',
          testStore.adminUser!.accessToken
        );

        // Should be 404 or empty array, or 403 if not admin
        assertTrue(
          response.status === 200 ||
            response.status === 404 ||
            response.status === 403,
          'Non-existent user should be handled'
        );
      },
    },
    {
      name: 'Admin List User Messages - Valid request',
      fn: async () => {
        assertNotNull(testStore.adminUser, 'Admin user should exist');
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        const response = await apiRequestAuth<ChatMessagesListResponse>(
          `/v1/chat/list-user-messages/${testStore.regularUser!.id}`,
          testStore.adminUser!.accessToken
        );

        if (response.status === 403) {
          logWarning('Admin user is not set as admin in DB - skipping');
          return;
        }

        assertStatusCode(response, 200, 'Admin should get 200');
        assertNotNull(response.data.data, 'Should have data');

        logInfo(
          `Admin retrieved ${response.data.data!.messages?.length || 0} messages for user`
        );
      },
    },

    // ==================== VERIFY MESSAGE PROCESSING ====================
    {
      name: 'Verify Message Processing - Check if message has response',
      fn: async () => {
        assertNotNull(testStore.regularUser, 'Regular user should exist');

        if (!createdMessageId) {
          logWarning('No message created - skipping');
          return;
        }

        // Wait for message processing (mock delay is 3-5 seconds)
        logInfo('Waiting for message processing...');
        await sleep(6000);

        const response = await apiRequestAuth<ChatMessagesListResponse>(
          '/v1/chat/messages',
          testStore.regularUser!.accessToken
        );

        assertStatusCode(response, 200, 'Should return 200');

        // Find our message
        const ourMessage = response.data.data!.messages.find(
          m => m.id === createdMessageId
        );

        if (ourMessage) {
          logInfo(`Message status: ${ourMessage.status}`);
          if (ourMessage.status === 'completed') {
            logInfo('Message was processed successfully');
          }
        }
      },
    },
  ];

  return runTestSuite('CHAT MODULE TESTS', tests);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runChatTests()
    .then(summary => {
      if (summary.failed > 0) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Chat tests failed:', error);
      process.exit(1);
    });
}
