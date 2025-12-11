import Redis from 'ioredis';

import Config from '~/configs';

let redisClient: Redis | null = null;

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    redisClient = new Redis({
      host: Config.REDIS_HOST,
      port: Config.REDIS_PORT,
      password: Config.REDIS_PASSWORD || undefined,
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

// Export a singleton instance for direct usage
export const redis = getRedisClient();
