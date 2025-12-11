import { and, eq, isNull } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import { db } from '~/shared/infra/db/config/config';
import { bundleTiers } from '~/shared/infra/db/schemas/bundle_tiers';
import { BundleTier } from '~/shared/infra/db/types';
import { BaseReadRepository } from '~/shared/infra/persistence/repository/read';

@singleton()
export class BundleTierReadRepository extends BaseReadRepository<
  typeof bundleTiers
> {
  constructor() {
    super(bundleTiers, db);
  }

  async findByName(name: string): Promise<BundleTier | null> {
    const result = await this.db
      .select()
      .from(bundleTiers)
      .where(and(eq(bundleTiers.name, name), isNull(bundleTiers.deletedAt)))
      .limit(1);

    return result[0] || null;
  }

  async findAll(): Promise<BundleTier[]> {
    return this.db
      .select()
      .from(bundleTiers)
      .where(isNull(bundleTiers.deletedAt));
  }

  async findActive(): Promise<BundleTier[]> {
    return this.db
      .select()
      .from(bundleTiers)
      .where(
        and(eq(bundleTiers.isActive, true), isNull(bundleTiers.deletedAt))
      );
  }

  async getAny(id: string): Promise<BundleTier | null> {
    const result = await this.db
      .select()
      .from(bundleTiers)
      .where(and(eq(bundleTiers.id, id), isNull(bundleTiers.deletedAt)))
      .limit(1);

    return result[0] || null;
  }
}
