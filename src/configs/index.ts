import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables - try .env.local first, then .env
dotenv.config({ path: '.env.local' });
dotenv.config(); // This will not override existing values from .env.local

// Environment validation schema
const envSchema = z.object({
  // Application
  APP_PORT: z.string().transform(Number).default('3001'),
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Database
  DB_HOST: z.string().min(1, 'DB_HOST is required'),
  DB_USER: z.string().min(1, 'DB_USER is required'),
  DB_PASS: z.string().min(1, 'DB_PASS is required'),
  DB_DATABASE: z.string().min(1, 'DB_DATABASE is required'),
  DB_DATABASE_TEST: z.string().optional().default('ddd_test'),
  DB_PORT: z.string().transform(Number).default('5432'),

  // Redis
  REDIS_HOST: z.string().min(1, 'REDIS_HOST is required'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_USE_PASSWORD: z.enum(['yes', 'no']).default('no'),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_DB: z.string().transform(Number).default('0'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Security
  BCRYPT_SALT_ROUNDS: z.string().transform(Number).default('12'),
});

// Parse and validate environment variables
const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Environment validation failed:');
    result.error.issues.forEach(issue => {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    });
    console.error(
      '\nPlease check your .env file and ensure all required variables are set.'
    );
    process.exit(1);
  }

  return result.data;
};

const env = parseEnv();

export type APP_ENV_TYPES = 'development' | 'test' | 'production';

// Helper function to parse duration string to milliseconds
const parseDurationToMs = (duration: string): number => {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60 * 1000; // Default 15 minutes

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 15 * 60 * 1000;
  }
};

// Helper function to parse duration string to seconds (for Redis TTL)
const parseDurationToSeconds = (duration: string): number => {
  return Math.floor(parseDurationToMs(duration) / 1000);
};

abstract class Config {
  // Application
  static readonly APP_PORT = env.APP_PORT;
  static readonly APP_ENV: APP_ENV_TYPES = env.APP_ENV;

  // Database
  static readonly DB_HOST = env.DB_HOST;
  static readonly DB_USER = env.DB_USER;
  static readonly DB_PASS = env.DB_PASS;
  static readonly DB_DATABASE = env.DB_DATABASE;
  static readonly DB_DATABASE_TEST = env.DB_DATABASE_TEST;
  static readonly DB_PORT = env.DB_PORT;

  // Redis
  static readonly REDIS_HOST = env.REDIS_HOST;
  static readonly REDIS_PORT = env.REDIS_PORT;
  static readonly REDIS_USE_PASSWORD = env.REDIS_USE_PASSWORD;
  static readonly REDIS_PASSWORD = env.REDIS_PASSWORD;
  static readonly REDIS_DB = env.REDIS_DB;

  // JWT
  static readonly JWT_SECRET = env.JWT_SECRET;
  static readonly JWT_ACCESS_EXPIRY = env.JWT_ACCESS_EXPIRY;
  static readonly JWT_REFRESH_EXPIRY = env.JWT_REFRESH_EXPIRY;
  static readonly JWT_ACCESS_EXPIRY_MS = parseDurationToMs(
    env.JWT_ACCESS_EXPIRY
  );
  static readonly JWT_REFRESH_EXPIRY_MS = parseDurationToMs(
    env.JWT_REFRESH_EXPIRY
  );
  static readonly JWT_REFRESH_EXPIRY_SECONDS = parseDurationToSeconds(
    env.JWT_REFRESH_EXPIRY
  );

  // Security
  static readonly BCRYPT_SALT_ROUNDS = env.BCRYPT_SALT_ROUNDS;

  // Business Rules
  static readonly FREE_TIER_MESSAGES = 3;
  static readonly PAYMENT_FAILURE_RATE = 0.05; // 5% failure rate
  static readonly OPENAI_MOCK_DELAY_MIN = 3000; // 3 seconds
  static readonly OPENAI_MOCK_DELAY_MAX = 5000; // 5 seconds
}

export default Config;
