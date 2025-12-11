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

import { bundleTiers } from './bundle_tiers';
import { users } from './users';

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    bundleTierId: uuid('bundle_tier_id')
      .notNull()
      .references(() => bundleTiers.id),

    // Bundle snapshot at purchase time (prevents edits from affecting existing subscriptions)
    bundleName: varchar('bundle_name', { length: 100 }).notNull(),
    bundleMaxMessages: integer('bundle_max_messages').notNull(),
    bundlePrice: decimal('bundle_price', { precision: 10, scale: 2 }).notNull(),

    // Subscription details
    billingCycle: varchar('billing_cycle', { length: 20 }).notNull(), // 'monthly' | 'yearly'
    autoRenewal: boolean('auto_renewal').notNull().default(true),
    status: boolean('status').notNull().default(true), // active or not

    // Dates
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }).notNull(),
    renewalDate: timestamp('renewal_date', { withTimezone: true }).notNull(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => ({
    userIdIdx: index('subscriptions_user_id_idx').on(table.userId),
    bundleTierIdIdx: index('subscriptions_bundle_tier_id_idx').on(
      table.bundleTierId
    ),
    statusIdx: index('subscriptions_status_idx').on(table.status),
    startDateIdx: index('subscriptions_start_date_idx').on(table.startDate),
    endDateIdx: index('subscriptions_end_date_idx').on(table.endDate),
    renewalDateIdx: index('subscriptions_renewal_date_idx').on(
      table.renewalDate
    ),
  })
);
