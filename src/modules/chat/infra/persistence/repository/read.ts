import { desc, eq } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import { db } from '~/shared/infra/db/config/config';
import { chatMessages } from '~/shared/infra/db/schemas/chat_messages';
import { ChatMessage } from '~/shared/infra/db/types';
import { BaseReadRepository } from '~/shared/infra/persistence/repository/read';

@singleton()
export class ChatMessageReadRepository extends BaseReadRepository<
  typeof chatMessages
> {
  constructor() {
    super(chatMessages, db);
  }

  async findByUserId(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<ChatMessage[]> {
    const { limit = 50, offset = 0 } = options;

    return this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async countByUserId(userId: string): Promise<number> {
    return this.count({ userId });
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
