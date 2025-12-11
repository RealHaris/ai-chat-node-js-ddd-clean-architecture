import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import { db } from '~/shared/infra/db/config/config';
import { subscriptions } from '~/shared/infra/db/schemas/subscriptions';
import { Subscription } from '~/shared/infra/db/types';
import { BaseReadRepository } from '~/shared/infra/persistence/repository/read';

@singleton()
export class SubscriptionReadRepository extends BaseReadRepository<
  typeof subscriptions
> {
  constructor() {
    super(subscriptions, db);
  }

  async findByUserId(userId: string): Promise<Subscription[]> {
    return this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt));
  }

  async findActiveByUserId(userId: string): Promise<Subscription[]> {
    const now = new Date();
    return this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, true),
          gt(subscriptions.endDate, now),
          isNull(subscriptions.cancelledAt)
        )
      )
      .orderBy(desc(subscriptions.startDate));
  }

  async findActiveByUserIdAndBundleId(
    userId: string,
    bundleTierId: string
  ): Promise<Subscription | null> {
    const now = new Date();
    const result = await this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.bundleTierId, bundleTierId),
          eq(subscriptions.status, true),
          gt(subscriptions.endDate, now),
          isNull(subscriptions.cancelledAt)
        )
      )
      .limit(1);

    return result[0] || null;
  }

  async findById(id: string): Promise<Subscription | null> {
    const result = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findDueForRenewal(date: Date): Promise<Subscription[]> {
    return this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, true),
          eq(subscriptions.autoRenewal, true),
          isNull(subscriptions.cancelledAt),
          eq(subscriptions.renewalDate, date)
        )
      );
  }
}
