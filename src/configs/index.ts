import dotenv from 'dotenv';

dotenv.config();

export type APP_ENV_TYPES = 'development' | 'test' | 'production';

abstract class Config {
  // Application
  static readonly APP_PORT = process.env.APP_PORT || 3001;
  static readonly APP_ENV: APP_ENV_TYPES =
    (process.env.APP_ENV as APP_ENV_TYPES) || 'development';

  // Database
  static readonly DB_HOST = process.env.DB_HOST || '127.0.0.1';
  static readonly DB_USER = process.env.DB_USER || 'postgres';
  static readonly DB_PASS = process.env.DB_PASS || 'postgres';
  static readonly DB_DATABASE = process.env.DB_DATABASE || 'ddd';
  static readonly DB_DATABASE_TEST = process.env.DB_DATABASE_TEST || 'ddd_test';
  static readonly DB_PORT = process.env.DB_PORT || 5432;

  // Redis
  static readonly REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
  static readonly REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
  static readonly REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';
  static readonly REDIS_DB = parseInt(process.env.REDIS_DB || '0', 10);

  // JWT
  static readonly JWT_SECRET =
    process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
  static readonly JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
  static readonly JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

  // Security
  static readonly BCRYPT_SALT_ROUNDS = parseInt(
    process.env.BCRYPT_SALT_ROUNDS || '12',
    10
  );

  // Business Rules
  static readonly FREE_TIER_MESSAGES = 3;
  static readonly PAYMENT_FAILURE_RATE = 0.05; // 5% failure rate
  static readonly OPENAI_MOCK_DELAY_MIN = 3000; // 3 seconds
  static readonly OPENAI_MOCK_DELAY_MAX = 5000; // 5 seconds
}

export default Config;
