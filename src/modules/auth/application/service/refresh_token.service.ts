import { singleton } from 'tsyringe';

import Config from '~/configs';
import { redis } from '~/shared/infra/redis/client';

const REFRESH_TOKEN_PREFIX = 'refresh_token:';
const USER_TOKENS_PREFIX = 'user_tokens:';

export interface RefreshTokenData {
  userId: string;
  email: string;
  role: string;
  createdAt: number;
}

@singleton()
export class RefreshTokenService {
  /**
   * Store a refresh token in Redis with TTL
   */
  async storeToken(token: string, data: RefreshTokenData): Promise<void> {
    const key = `${REFRESH_TOKEN_PREFIX}${token}`;
    const userKey = `${USER_TOKENS_PREFIX}${data.userId}`;

    // Store token data with TTL
    await redis.setex(
      key,
      Config.JWT_REFRESH_EXPIRY_SECONDS,
      JSON.stringify(data)
    );

    // Add token to user's token set (for revoking all user tokens)
    await redis.sadd(userKey, token);
    // Set TTL on user's token set (refresh on each new token)
    await redis.expire(userKey, Config.JWT_REFRESH_EXPIRY_SECONDS);
  }

  /**
   * Get refresh token data from Redis
   */
  async getToken(token: string): Promise<RefreshTokenData | null> {
    const key = `${REFRESH_TOKEN_PREFIX}${token}`;
    const data = await redis.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data) as RefreshTokenData;
  }

  /**
   * Revoke a single refresh token
   */
  async revokeToken(token: string): Promise<void> {
    const key = `${REFRESH_TOKEN_PREFIX}${token}`;

    // Get token data to find user
    const data = await this.getToken(token);
    if (data) {
      const userKey = `${USER_TOKENS_PREFIX}${data.userId}`;
      await redis.srem(userKey, token);
    }

    await redis.del(key);
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    const userKey = `${USER_TOKENS_PREFIX}${userId}`;

    // Get all user's tokens
    const tokens = await redis.smembers(userKey);

    // Delete each token
    if (tokens.length > 0) {
      const tokenKeys = tokens.map(t => `${REFRESH_TOKEN_PREFIX}${t}`);
      await redis.del(...tokenKeys);
    }

    // Delete the user's token set
    await redis.del(userKey);
  }

  /**
   * Check if a token exists and is valid
   */
  async isTokenValid(token: string): Promise<boolean> {
    const key = `${REFRESH_TOKEN_PREFIX}${token}`;
    const exists = await redis.exists(key);
    return exists === 1;
  }
}
