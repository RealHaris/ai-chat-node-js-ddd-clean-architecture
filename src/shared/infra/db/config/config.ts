import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import Config from '~/configs';

const connectionString = `postgresql://${Config.DB_USER}:${Config.DB_PASS}@${Config.DB_HOST}:${Config.DB_PORT}/${Config.DB_DATABASE}`;

console.log(`Connecting to the database in ${Config.APP_ENV} mode`);

// Create postgres client
const client = postgres(connectionString, {
  max: 40,
  idle_timeout: 10,
  connect_timeout: 60,
});

// Create drizzle instance
export const db = drizzle(client);

export const initDB = async () => {
  try {
    // Test the connection
    await client`SELECT 1`;
    console.log('Connection has been established successfully.');
  } catch (err) {
    console.log('Unable to connect to the database', err);
  }
};

export const initMigration = async () => {
  try {
    console.log(
      "Migration setup complete. Run 'npm run migration:push' to apply migrations."
    );
  } catch (err) {
    console.log(`Migration setup failed: ${err}`);
  }
};
