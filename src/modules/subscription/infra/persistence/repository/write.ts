import { eq } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import { Subscription as SubscriptionEntity } from '~/modules/subscription/domain/entity/subscription';
import { db } from '~/shared/infra/db/config/config';
import { subscriptions } from '~/shared/infra/db/schemas/subscriptions';
import { Subscription } from '~/shared/infra/db/types';
import { BaseWriteRepository } from '~/shared/infra/persistence/repository/write';

@singleton()
export class SubscriptionWriteRepository extends BaseWriteRepository<
  typeof subscriptions,
  any
> {
  constructor() {
    super(subscriptions, db);
  }

  async save(subscription: SubscriptionEntity): Promise<Subscription> {
    const values = subscription.toObject();

    const result = await this.db
      .insert(subscriptions)
      .values({
        userId: values.userId,
        bundleTierId: values.bundleTierId,
        bundleName: values.bundleName,
        bundleMaxMessages: values.bundleMaxMessages,
        bundlePrice: values.bundlePrice,
        billingCycle: values.billingCycle,
        autoRenewal: values.autoRenewal ?? true,
        status: values.status ?? true,
        startDate: values.startDate,
        endDate: values.endDate,
        renewalDate: values.renewalDate,
      })
      .returning();

    return result[0];
  }

  async update(subscription: SubscriptionEntity): Promise<Subscription> {
    const values = subscription.toObject();

    const result = await this.db
      .update(subscriptions)
      .set({
        autoRenewal: values.autoRenewal,
        status: values.status,
        endDate: values.endDate,
        renewalDate: values.renewalDate,
        cancelledAt: values.cancelledAt,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, values.id))
      .returning();

    return result[0];
  }

  async cancel(id: string): Promise<Subscription> {
    const result = await this.db
      .update(subscriptions)
      .set({
        status: false,
        autoRenewal: false,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, id))
      .returning();

    return result[0];
  }

  async toggleAutoRenewal(
    id: string,
    autoRenewal: boolean
  ): Promise<Subscription> {
    const result = await this.db
      .update(subscriptions)
      .set({
        autoRenewal,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, id))
      .returning();

    return result[0];
  }
}
