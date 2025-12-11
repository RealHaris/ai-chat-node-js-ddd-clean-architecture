import Redis from 'ioredis';

import Config from '~/configs';

let redisClient: Redis | null = null;

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    redisClient = new Redis({
      host: Config.REDIS_HOST,
      port: Config.REDIS_PORT,
      password:
        Config.REDIS_USE_PASSWORD === 'yes' ? Config.REDIS_PASSWORD : undefined,
      db: Config.REDIS_DB,
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
    });

    redisClient.on('connect', () => {
      console.log('Redis client connected');
    });

    redisClient.on('error', err => {
      console.error('Redis client error:', err);
    });
  }

  return redisClient;
};

export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('Redis connection closed');
  }
};

// Test Redis connection
export const testRedisConnection = async (): Promise<boolean> => {
  try {
    const client = getRedisClient();
    await client.ping();
    return true;
  } catch (error) {
    console.error(
      'Redis connection test failed:',
      error instanceof Error ? error.message : error
    );
    return false;
  }
};

// Export a singleton instance for direct usage
export const redis = getRedisClient();
