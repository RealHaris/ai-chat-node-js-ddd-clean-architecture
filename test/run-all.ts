/**
 * Test Runner - Runs all test suites
 *
 * Usage: npm run test
 */

import { runAuthTests } from './auth.test';
import { runBundleTierTests } from './bundle-tier.test';
import { runChatTests } from './chat.test';
import { runE2ETests } from './e2e.test';
import { runAdvancedE2ETests } from './advanced-e2e.test';
import { runSubscriptionTests } from './subscription.test';
import { runUserTests } from './user.test';
import { TestSummary, logInfo, logSection, printFinalSummary } from './utils';

interface SuiteResult {
  name: string;
  summary: TestSummary;
}

async function runAllTests(): Promise<void> {
  logSection('STARTING TEST SUITE');
  logInfo(
    `Test server: ${process.env.TEST_BASE_URL || 'http://localhost:3001'}`
  );
  logInfo(`Time: ${new Date().toISOString()}`);
  console.log();

  const results: SuiteResult[] = [];

  // Parse command line args to determine which tests to run
  const args = process.argv.slice(2);
  const runAll = args.length === 0 || args.includes('--all');
  const runOnly = args.filter(a => !a.startsWith('--'));

  const shouldRun = (name: string): boolean => {
    if (runAll) return true;
    return runOnly.some(
      arg =>
        name.toLowerCase().includes(arg.toLowerCase()) ||
        arg.toLowerCase().includes(name.toLowerCase())
    );
  };

  try {
    // Run test suites in order
    if (shouldRun('auth')) {
      const authSummary = await runAuthTests();
      results.push({ name: 'Auth Tests', summary: authSummary });
    }

    if (shouldRun('user')) {
      const userSummary = await runUserTests();
      results.push({ name: 'User Tests', summary: userSummary });
    }

    if (shouldRun('bundle') || shouldRun('tier')) {
      const bundleSummary = await runBundleTierTests();
      results.push({ name: 'Bundle Tier Tests', summary: bundleSummary });
    }

    if (shouldRun('subscription') || shouldRun('sub')) {
      const subSummary = await runSubscriptionTests();
      results.push({ name: 'Subscription Tests', summary: subSummary });
    }

    if (shouldRun('chat')) {
      const chatSummary = await runChatTests();
      results.push({ name: 'Chat Tests', summary: chatSummary });
    }

    if (shouldRun('e2e') || shouldRun('end')) {
      const e2eSummary = await runE2ETests();
      results.push({ name: 'E2E Tests', summary: e2eSummary });
    }

    if (shouldRun('advanced')) {
      const advancedSummary = await runAdvancedE2ETests();
      results.push({ name: 'Advanced E2E Tests', summary: advancedSummary });
    }

    // Print final summary
    if (results.length > 0) {
      printFinalSummary(results);
    } else {
      logInfo('No tests were run. Use --all or specify test names.');
      logInfo('Available: auth, user, bundle, subscription, chat, e2e, advanced');
    }
  } catch (error) {
    console.error('\nTest runner encountered an error:', error);
    process.exit(1);
  }
}

// Run tests
runAllTests();
