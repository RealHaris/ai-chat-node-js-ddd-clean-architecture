/**
 * Test Server Setup
 * Starts the application server programmatically for tests
 */

import 'reflect-metadata';

import { createApp } from '../src/app';

let server: import('http').Server | null = null;

// Start server for tests
export async function startTestServer(): Promise<void> {
  if (server) {
    return; // Server already running
  }

  // Set test environment
  process.env.APP_ENV = 'test';

  // Set default test database if not set
  if (!process.env.DB_DATABASE) {
    process.env.DB_DATABASE = process.env.DB_DATABASE_TEST || 'ddd_test';
  }

  if (!process.env.APP_PORT) {
    process.env.APP_PORT = '3001'; // Default test port
  }

  // Use test-specific database configuration
  console.log('Starting test server with configuration:');
  console.log(`  - APP_ENV: ${process.env.APP_ENV}`);
  console.log(`  - APP_PORT: ${process.env.APP_PORT}`);
  console.log(`  - DB_DATABASE: ${process.env.DB_DATABASE}`);
  console.log(`  - DB_HOST: ${process.env.DB_HOST || 'localhost'}`);

  try {
    const app = await createApp();
    const port = parseInt(process.env.APP_PORT, 10) || 3000;

    server = app.listen(port, () => {
      console.log(`Test server running on port ${port}`);
    });

    // Wait a bit for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error) {
    console.error('Failed to start test server:', error);
    console.error(
      'This may be because required services (PostgreSQL, Redis) are not running'
    );
    throw error;
  }
}

// Stop server after tests
export async function stopTestServer(): Promise<void> {
  if (server) {
    server.close((err?: Error) => {
      if (err) {
        console.error('Error closing test server:', err);
      } else {
        console.log('Test server stopped');
      }
    });
    server = null;
  }
}

// Export for use in test setup
export { server };
