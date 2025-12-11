import { eq } from 'drizzle-orm';
import { injectable, singleton } from 'tsyringe';

import { db } from '~/shared/infra/db/config/config';
import { users } from '~/shared/infra/db/schemas/users';
import { User } from '~/shared/infra/db/types';
import { QuotaExceededError } from '~/shared/infra/error';

export interface QuotaInfo {
  totalRemainingMessages: number;
  isFreeTier: boolean;
  latestBundleId: string | null;
  latestBundleRemainingQuota: number | null;
  latestBundleName: string | null;
  latestBundleMaxMessages: number | null;
  hasQuota: boolean;
  isUnlimited: boolean;
}

@singleton()
@injectable()
export class QuotaService {
  async getQuotaInfo(userId: string): Promise<QuotaInfo> {
    const result = await db
      .select({
        totalRemainingMessages: users.totalRemainingMessages,
        isFreeTier: users.isFreeTier,
        latestBundleId: users.latestBundleId,
        latestBundleRemainingQuota: users.latestBundleRemainingQuota,
        latestBundleName: users.latestBundleName,
        latestBundleMaxMessages: users.latestBundleMaxMessages,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const user = result[0];

    if (!user) {
      throw new Error('User not found');
    }

    const isUnlimited = user.latestBundleMaxMessages === -1;
    const hasQuota = isUnlimited || user.totalRemainingMessages > 0;

    return {
      totalRemainingMessages: user.totalRemainingMessages,
      isFreeTier: user.isFreeTier,
      latestBundleId: user.latestBundleId,
      latestBundleRemainingQuota: user.latestBundleRemainingQuota,
      latestBundleName: user.latestBundleName,
      latestBundleMaxMessages: user.latestBundleMaxMessages,
      hasQuota,
      isUnlimited,
    };
  }

  async deductQuota(userId: string, amount: number = 1): Promise<QuotaInfo> {
    const quotaInfo = await this.getQuotaInfo(userId);

    // If unlimited, no deduction needed
    if (quotaInfo.isUnlimited) {
      return quotaInfo;
    }

    // Check if user has enough quota
    if (quotaInfo.totalRemainingMessages < amount) {
      throw new QuotaExceededError(
        'Insufficient message quota. Please upgrade your plan or wait for renewal.'
      );
    }

    // Deduct from total remaining messages
    const newTotalRemaining = quotaInfo.totalRemainingMessages - amount;

    // If user has a bundle subscription, also deduct from bundle quota
    let newBundleRemaining = quotaInfo.latestBundleRemainingQuota;
    if (
      quotaInfo.latestBundleId &&
      newBundleRemaining !== null &&
      newBundleRemaining > 0
    ) {
      newBundleRemaining = Math.max(0, newBundleRemaining - amount);
    }

    await db
      .update(users)
      .set({
        totalRemainingMessages: newTotalRemaining,
        latestBundleRemainingQuota: newBundleRemaining,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return {
      ...quotaInfo,
      totalRemainingMessages: newTotalRemaining,
      latestBundleRemainingQuota: newBundleRemaining,
      hasQuota: newTotalRemaining > 0,
    };
  }

  async addQuota(
    userId: string,
    subscriptionId: string,
    bundleName: string,
    bundleMaxMessages: number
  ): Promise<User> {
    const currentUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!currentUser[0]) {
      throw new Error('User not found');
    }

    const isUnlimited = bundleMaxMessages === -1;
    const currentTotal = currentUser[0].totalRemainingMessages;

    // Calculate new total:
    // - If new bundle is unlimited, set to -1 (unlimited indicator or just use a very high number)
    // - Otherwise, add bundle messages to current total
    const newTotal = isUnlimited
      ? 999999999 // Very high number for unlimited (or use -1 as sentinel)
      : currentTotal + bundleMaxMessages;

    const result = await db
      .update(users)
      .set({
        totalRemainingMessages: newTotal,
        isFreeTier: false,
        latestBundleId: subscriptionId,
        latestBundleRemainingQuota: bundleMaxMessages,
        latestBundleName: bundleName,
        latestBundleMaxMessages: bundleMaxMessages,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return result[0];
  }

  async resetFreeTierQuota(userId: string): Promise<User> {
    const result = await db
      .update(users)
      .set({
        totalRemainingMessages: 3, // Free tier default
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return result[0];
  }

  async resetAllFreeTierUsers(): Promise<number> {
    const result = await db
      .update(users)
      .set({
        totalRemainingMessages: 3,
        updatedAt: new Date(),
      })
      .where(eq(users.isFreeTier, true))
      .returning();

    return result.length;
  }
}
