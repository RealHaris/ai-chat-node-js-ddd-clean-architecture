import { eq, and, desc, sql } from 'drizzle-orm';
import { AnyPgTable, InferSelectModel } from 'drizzle-orm/pg-core';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { NotFoundError } from '~/shared/infra/error';
import { db } from '~/shared/infra/db/config/config';

export abstract class BaseReadRepository<TableType extends AnyPgTable> {
  protected readonly table: TableType;
  protected readonly db: PostgresJsDatabase<Record<string, unknown>>;

  constructor(table: TableType, dbInstance = db) {
    this.table = table;
    this.db = dbInstance;
  }

  async get(id: string): Promise<InferSelectModel<TableType>> {
    const result = await this.db
      .select()
      .from(this.table)
      .where(eq((this.table as unknown as { id: unknown }).id, id))
      .limit(1);

    if (!result[0]) {
      throw new NotFoundError(
        `Could not find ${(this.table as unknown as { name?: string }).name || 'unknown'} ${id}`
      );
    }

    return result[0];
  }

  async getAny(id: string): Promise<InferSelectModel<TableType> | null> {
    const result = await this.db
      .select()
      .from(this.table)
      .where(eq((this.table as unknown as { id: unknown }).id, id))
      .limit(1);

    return result[0] || null;
  }

  async getAll(
    options: { limit?: number; offset?: number } = {}
  ): Promise<InferSelectModel<TableType>[]> {
    const query = this.db
      .select()
      .from(this.table)
      .orderBy(desc((this.table as unknown as { createdAt: unknown }).createdAt));

    if (options.limit) {
      query.limit(options.limit);
    }

    if (options.offset) {
      query.offset(options.offset);
    }

    return query;
  }

  async first(whereClause: Record<string, unknown> = {}): Promise<InferSelectModel<TableType> | null> {
    const result = await this.firstAny(whereClause);

    if (!result) {
      throw new NotFoundError(
        `Could not find ${(this.table as any).name || 'unknown'} ${JSON.stringify(whereClause)}`
      );
    }

    return result;
  }

  async firstAny(whereClause: Record<string, unknown> = {}): Promise<InferSelectModel<TableType> | null> {
    const conditions = Object.entries(whereClause).map(([key, value]) =>
      eq((this.table as unknown as Record<string, unknown>)[key], value)
    );

    const whereCondition =
      conditions.length > 0 ? and(...conditions) : undefined;

    const result = await this.db
      .select()
      .from(this.table)
      .where(whereCondition)
      .orderBy(desc((this.table as unknown as { createdAt: unknown }).createdAt))
      .limit(1);

    return result[0] || null;
  }

  async where(
    whereClause: Record<string, unknown> = {},
    options: { limit?: number; offset?: number } = {}
  ): Promise<InferSelectModel<TableType>[]> {
    const conditions = Object.entries(whereClause).map(([key, value]) =>
      eq((this.table as unknown as Record<string, unknown>)[key], value)
    );

    const whereCondition =
      conditions.length > 0 ? and(...conditions) : undefined;

    const query = this.db
      .select()
      .from(this.table)
      .where(whereCondition)
      .orderBy(desc((this.table as unknown as { createdAt: unknown }).createdAt));

    if (options.limit) {
      query.limit(options.limit);
    }

    if (options.offset) {
      query.offset(options.offset);
    }

    return query;
  }

  async count(whereClause: Record<string, unknown> = {}): Promise<number> {
    const conditions = Object.entries(whereClause).map(([key, value]) =>
      eq((this.table as any)[key], value)
    );

    const whereCondition =
      conditions.length > 0 ? and(...conditions) : undefined;

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(this.table)
      .where(whereCondition);

    return result[0]?.count || 0;
  }
}
