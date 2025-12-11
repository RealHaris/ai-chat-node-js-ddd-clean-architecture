import {
  boolean,
  decimal,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { users } from './users';

export const bundleTiers = pgTable(
  'bundle_tiers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull().unique(),
    maxMessages: integer('max_messages').notNull(), // -1 for unlimited
    priceMonthly: decimal('price_monthly', {
      precision: 10,
      scale: 2,
    }).notNull(),
    priceYearly: decimal('price_yearly', { precision: 10, scale: 2 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  table => ({
    nameIdx: index('bundle_tiers_name_idx').on(table.name),
    isActiveIdx: index('bundle_tiers_is_active_idx').on(table.isActive),
    createdByIdx: index('bundle_tiers_created_by_idx').on(table.createdBy),
  })
);
