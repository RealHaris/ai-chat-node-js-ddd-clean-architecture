import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { users } from './users';

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    query: text('query').notNull(), // User's question
    response: text('response'), // OpenAI response
    tokens: jsonb('tokens'), // { prompt_tokens, completion_tokens, total_tokens, ... }
    status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'completed' | 'failed'
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => ({
    userIdIdx: index('chat_messages_user_id_idx').on(table.userId),
    statusIdx: index('chat_messages_status_idx').on(table.status),
    createdAtIdx: index('chat_messages_created_at_idx').on(table.createdAt),
  })
);
