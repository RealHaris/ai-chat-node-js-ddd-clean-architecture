import { and, desc, eq, sql } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import { db } from '~/shared/infra/db/config/config';
import { chatMessages } from '~/shared/infra/db/schemas/chat_messages';
import { ChatMessage } from '~/shared/infra/db/types';
import { BaseReadRepository } from '~/shared/infra/persistence/repository/read';

export interface FindMessagesOptions {
  limit?: number;
  offset?: number;
  status?: 'pending' | 'completed' | 'failed';
}

@singleton()
export class ChatMessageReadRepository extends BaseReadRepository<
  typeof chatMessages
> {
  constructor() {
    super(chatMessages, db);
  }

  async findByUserId(
    userId: string,
    options: FindMessagesOptions = {}
  ): Promise<ChatMessage[]> {
    const { limit = 20, offset = 0, status } = options;

    const conditions = [eq(chatMessages.userId, userId)];

    if (status) {
      conditions.push(eq(chatMessages.status, status));
    }

    return this.db
      .select()
      .from(chatMessages)
      .where(and(...conditions))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async countByUserId(
    userId: string,
    status?: 'pending' | 'completed' | 'failed'
  ): Promise<number> {
    const conditions = [eq(chatMessages.userId, userId)];

    if (status) {
      conditions.push(eq(chatMessages.status, status));
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(chatMessages)
      .where(and(...conditions));

    return Number(result[0]?.count || 0);
  }

  async findById(id: string): Promise<ChatMessage | null> {
    const result = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, id))
      .limit(1);

    return result[0] || null;
  }
}
