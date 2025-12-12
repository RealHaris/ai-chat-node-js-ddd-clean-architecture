import { eq } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import { db } from '~/shared/infra/db/config/config';
import { chatMessages } from '~/shared/infra/db/schemas/chat_messages';
import { ChatMessage } from '~/shared/infra/db/types';
import { BaseWriteRepository } from '~/shared/infra/persistence/repository/write';

interface CreateChatMessageInput {
  userId: string;
  query: string;
}

interface UpdateChatMessageInput {
  response?: string;
  tokens?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  status?: 'pending' | 'completed' | 'failed';
  errorMessage?: string;
}

@singleton()
export class ChatMessageWriteRepository extends BaseWriteRepository<
  typeof chatMessages,
  ChatMessage
> {
  constructor() {
    super(chatMessages, db);
  }

  async createPending(input: CreateChatMessageInput): Promise<ChatMessage> {
    const result = await this.db
      .insert(chatMessages)
      .values({
        userId: input.userId,
        query: input.query,
        status: 'pending',
      })
      .returning();

    return result[0];
  }

  async updateWithResponse(
    id: string,
    input: UpdateChatMessageInput
  ): Promise<ChatMessage> {
    const result = await this.db
      .update(chatMessages)
      .set({
        response: input.response,
        tokens: input.tokens,
        status: input.status,
        errorMessage: input.errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(chatMessages.id, id))
      .returning();

    return result[0];
  }

  async markFailed(id: string, errorMessage: string): Promise<ChatMessage> {
    const result = await this.db
      .update(chatMessages)
      .set({
        status: 'failed',
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(chatMessages.id, id))
      .returning();

    return result[0];
  }
}
