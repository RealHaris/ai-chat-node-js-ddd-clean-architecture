import { eq } from 'drizzle-orm';
import { Aggregate, EntityProps } from 'types-ddd';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { AnyPgTable } from 'drizzle-orm/pg-core';

import { db } from '~/shared/infra/db/config/config';
import {
  AggregateNotFound,
  NotFoundError,
  StateError,
} from '~/shared/infra/error';

type PolymorphicAggregate = object;

export abstract class BaseWriteRepository<
  TableType extends AnyPgTable,
  WriteAttributesType extends EntityProps,
  AggregateRootType extends PolymorphicAggregate = PolymorphicAggregate,
> {
  protected readonly table: TableType;
  protected readonly db: PostgresJsDatabase<any>;

  constructor(table: TableType, dbInstance = db) {
    this.table = table;
    this.db = dbInstance;
  }

  async getById(id: Aggregate<WriteAttributesType>['id']): Promise<any> {
    const result = await this.db
      .select()
      .from(this.table)
      .where(eq((this.table as any).id, id))
      .limit(1);

    if (!result[0]) {
      throw new AggregateNotFound((this.table as any).name || 'unknown', id);
    }

    return result[0];
  }

  async save(aggregateRoot: AggregateRootType): Promise<any> {
    const values = this.toValues(aggregateRoot);

    const result = await this.db.insert(this.table).values(values).returning();

    return result[0];
  }

  async update(aggregateRoot: AggregateRootType): Promise<any> {
    return await this.updateAny(aggregateRoot);
  }

  async updateAny(aggregateRoot: AggregateRootType): Promise<any> {
    if ('modifiable' in aggregateRoot && !(aggregateRoot as any).modifiable) {
      throw new StateError('Object is on an unmodifiable status');
    }

    const values = this.toValues(aggregateRoot);
    const result = await this.db
      .update(this.table)
      .set({
        ...values,
        updatedAt: new Date(),
      })
      .where(eq((this.table as any).id, values.id))
      .returning();

    if (!result[0]) {
      throw new NotFoundError(
        `Failed to update ${(this.table as any).name || 'unknown'}`
      );
    }

    return result[0];
  }

  async delete(id: Aggregate<WriteAttributesType>['id']): Promise<boolean> {
    const result = await this.db
      .delete(this.table)
      .where(eq((this.table as any).id, id))
      .returning();

    return result.length > 0;
  }

  static async beginTransaction<T>(callback: () => Promise<T>): Promise<T> {
    // Drizzle handles transactions differently - for now we'll use a simple approach
    // In production, you'd want proper transaction management
    return await callback();
  }

  protected toAggregateRoot(model: any): AggregateRootType {
    return Object.assign(model);
  }

  protected toValues(aggregateRoot: AggregateRootType) {
    const _aggregateRoot = aggregateRoot as Aggregate<WriteAttributesType>;
    return Object.assign(_aggregateRoot.toObject());
  }
}
