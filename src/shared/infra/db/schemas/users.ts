import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    password: text('password').notNull(),
    phone: text('phone'),
    role: varchar('role', { length: 20 }).notNull().default('user'), // 'user' | 'admin'

    // Quota management fields
    totalRemainingMessages: integer('total_remaining_messages')
      .notNull()
      .default(3),
    isFreeTier: boolean('is_free_tier').notNull().default(true),
    latestBundleId: uuid('latest_bundle_id'), // References subscriptions.id
    latestBundleRemainingQuota: integer(
      'latest_bundle_remaining_quota'
    ).default(0),

    // Bundle snapshot (denormalized for history preservation)
    latestBundleName: varchar('latest_bundle_name', { length: 100 }),
    latestBundleMaxMessages: integer('latest_bundle_max_messages'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  table => ({
    emailIdx: index('users_email_idx').on(table.email),
    phoneIdx: index('users_phone_idx').on(table.phone),
    roleIdx: index('users_role_idx').on(table.role),
    isFreeTierIdx: index('users_is_free_tier_idx').on(table.isFreeTier),
  })
);
