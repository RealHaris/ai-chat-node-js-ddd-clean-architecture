import { eq } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import { BundleTier as BundleTierEntity } from '~/modules/bundle-tier/domain/entity/bundle_tier';
import { db } from '~/shared/infra/db/config/config';
import { bundleTiers } from '~/shared/infra/db/schemas/bundle_tiers';
import { BundleTier } from '~/shared/infra/db/types';
import { BaseWriteRepository } from '~/shared/infra/persistence/repository/write';

@singleton()
export class BundleTierWriteRepository extends BaseWriteRepository<
  typeof bundleTiers,
  BundleTier
> {
  constructor() {
    super(bundleTiers, db);
  }

  async save(bundleTier: BundleTierEntity): Promise<BundleTier> {
    const values = bundleTier.toObject();

    const result = await this.db
      .insert(bundleTiers)
      .values({
        name: values.name,
        maxMessages: values.maxMessages,
        priceMonthly: values.priceMonthly,
        priceYearly: values.priceYearly,
        isActive: values.isActive ?? true,
        createdBy: values.createdBy || null,
      })
      .returning();

    return result[0];
  }

  async update(bundleTier: BundleTierEntity): Promise<BundleTier> {
    const values = bundleTier.toObject();

    const result = await this.db
      .update(bundleTiers)
      .set({
        name: values.name,
        maxMessages: values.maxMessages,
        priceMonthly: values.priceMonthly,
        priceYearly: values.priceYearly,
        isActive: values.isActive,
        updatedAt: new Date(),
      })
      .where(eq(bundleTiers.id, values.id))
      .returning();

    return result[0];
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.db
      .update(bundleTiers)
      .set({
        deletedAt: new Date(),
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(bundleTiers.id, id))
      .returning();

    return result.length > 0;
  }
}
