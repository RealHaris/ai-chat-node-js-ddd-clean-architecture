import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './users';

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    isRevoked: boolean('is_revoked').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => ({
    userIdIdx: index('refresh_tokens_user_id_idx').on(table.userId),
    tokenIdx: index('refresh_tokens_token_idx').on(table.token),
    expiresAtIdx: index('refresh_tokens_expires_at_idx').on(table.expiresAt),
    isRevokedIdx: index('refresh_tokens_is_revoked_idx').on(table.isRevoked),
  })
);
