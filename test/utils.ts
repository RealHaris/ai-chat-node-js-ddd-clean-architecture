/**
 * Test Utilities and Helpers
 * Provides common functionality for all test modules
 */


const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Log with color
 */
export function log(
  message: string,
  color: keyof typeof colors = 'reset'
): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

export function logSuccess(message: string): void {
  log(`✓ ${message}`, 'green');
}

export function logError(message: string): void {
  log(`✗ ${message}`, 'red');
}

export function logInfo(message: string): void {
  log(`ℹ ${message}`, 'blue');
}

export function logWarning(message: string): void {
  log(`⚠ ${message}`, 'yellow');
}

export function logSection(title: string): void {
  console.log(
    '\n' + colors.cyan + colors.bright + '═'.repeat(60) + colors.reset
  );
  console.log(colors.cyan + colors.bright + ` ${title}` + colors.reset);
  console.log(
    colors.cyan + colors.bright + '═'.repeat(60) + colors.reset + '\n'
  );
}

export function logSubsection(title: string): void {
  console.log('\n' + colors.yellow + `── ${title} ──` + colors.reset + '\n');
}

/**
 * Test result tracking
 */
export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}

/**
 * API Response interface
 */
export interface ApiResponse<T = unknown> {
  status: number;
  ok: boolean;
  data: T;
  headers: Headers;
}

/**
 * Make an API request
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${endpoint}`;

  // Log the endpoint URL
  const method = options.method || 'GET';
  console.log(`${colors.cyan}→ ${method} ${url}${colors.reset}`);

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  // Small delay to prevent overwhelming the server
  await new Promise(resolve => setTimeout(resolve, 50));

  let data: T;
  try {
    data = (await response.json()) as T;
  } catch {
    data = {} as T;
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
    headers: response.headers,
  };
}

/**
 * API request with authentication
 */
export async function apiRequestAuth<T = unknown>(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Generate random email
 */
export function randomEmail(): string {
  const random = Math.random().toString(36).substring(2, 10);
  return `test_${random}@example.com`;
}

/**
 * Generate random string
 */
export function randomString(length: number = 8): string {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length);
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test assertion helpers
 */
export function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: Expected ${expected}, got ${actual}`);
  }
}

export function assertNotNull<T>(
  value: T | null | undefined,
  message: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`${message}: Value is null or undefined`);
  }
}

export function assertTrue(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`${message}: Condition is false`);
  }
}

export function assertFalse(condition: boolean, message: string): void {
  if (condition) {
    throw new Error(`${message}: Condition is true`);
  }
}

export function assertStatusCode(
  response: ApiResponse,
  expected: number,
  message: string
): void {
  if (response.status !== expected) {
    throw new Error(
      `${message}: Expected status ${expected}, got ${response.status}. Response: ${JSON.stringify(response.data)}`
    );
  }
}

export function assertHasProperty<T extends object>(
  obj: T,
  property: string,
  message: string
): void {
  if (!(property in obj)) {
    throw new Error(`${message}: Object does not have property '${property}'`);
  }
}

/**
 * Run a single test
 */
export async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<TestResult> {
  const startTime = Date.now();
  try {
    await testFn();
    const duration = Date.now() - startTime;
    logSuccess(`${name} (${duration}ms)`);
    return { name, passed: true, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError(`${name} (${duration}ms)`);
    logError(`  Error: ${errorMessage}`);
    return { name, passed: false, error: errorMessage, duration };
  }
}

/**
 * Run all tests in a module
 */
export async function runTestSuite(
  suiteName: string,
  tests: Array<{ name: string; fn: () => Promise<void> }>
): Promise<TestSummary> {
  logSection(suiteName);

  const results: TestResult[] = [];

  for (const test of tests) {
    const result = await runTest(test.name, test.fn);
    results.push(result);
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n' + '-'.repeat(60));
  log(
    `Results: ${passed} passed, ${failed} failed, ${results.length} total`,
    failed > 0 ? 'red' : 'green'
  );

  return {
    total: results.length,
    passed,
    failed,
    results,
  };
}

/**
 * Print final summary
 */
export function printFinalSummary(
  summaries: Array<{ name: string; summary: TestSummary }>
): void {
  logSection('FINAL TEST SUMMARY');

  let totalPassed = 0;
  let totalFailed = 0;
  let totalTests = 0;

  for (const { name, summary } of summaries) {
    totalPassed += summary.passed;
    totalFailed += summary.failed;
    totalTests += summary.total;

    const status = summary.failed > 0 ? colors.red + '✗' : colors.green + '✓';
    console.log(
      `${status} ${name}: ${summary.passed}/${summary.total} passed${colors.reset}`
    );

    // List failed tests
    for (const result of summary.results) {
      if (!result.passed) {
        logError(`    - ${result.name}: ${result.error}`);
      }
    }
  }

  console.log('\n' + '═'.repeat(60));
  const allPassed = totalFailed === 0;
  log(
    `TOTAL: ${totalPassed}/${totalTests} tests passed (${totalFailed} failed)`,
    allPassed ? 'green' : 'red'
  );
  console.log('═'.repeat(60) + '\n');

  if (!allPassed) {
    process.exit(1);
  }
}

/**
 * Shared test data store
 */
export interface TestStore {
  // Users
  regularUser?: {
    id: string;
    email: string;
    password: string;
    accessToken: string;
    refreshToken: string;
  };
  adminUser?: {
    id: string;
    email: string;
    password: string;
    accessToken: string;
    refreshToken: string;
  };
  // Bundle Tiers
  bundleTiers: Array<{
    id: string;
    name: string;
    maxMessages: number;
    priceMonthly: string;
    priceYearly: string;
  }>;
  // Subscriptions
  subscriptions: Array<{
    id: string;
    userId: string;
    bundleTierId: string;
    billingCycle: string;
  }>;
  // Chat Messages
  chatMessages: Array<{
    id: string;
    userId: string;
    query: string;
    status: string;
  }>;
}

export const SEEDED_DATA = {
  ADMIN_USER: {
    email: 'admin@test.com',
    password: 'admin123',
  },
  TIERS: {
    BASIC: { name: 'Basic', maxMessages: 10 },
    PRO: { name: 'Pro', maxMessages: 100 },
    ENTERPRISE: { name: 'Enterprise', maxMessages: -1 },
  },
};

export const testStore: TestStore = {
  bundleTiers: [],
  subscriptions: [],
  chatMessages: [],
};

export default {
  apiRequest,
  apiRequestAuth,
  randomEmail,
  randomString,
  sleep,
  assertEqual,
  assertNotNull,
  assertTrue,
  assertFalse,
  assertStatusCode,
  assertHasProperty,
  runTest,
  runTestSuite,
  printFinalSummary,
  testStore,
  log,
  logSuccess,
  logError,
  logInfo,
  logWarning,
  logSection,
  logSubsection,
};
