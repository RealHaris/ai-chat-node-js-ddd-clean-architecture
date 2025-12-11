import { z } from 'zod';

// Send Message DTO
export const SendMessageDTOSchema = z.object({
  query: z
    .string({ required_error: 'Query is required' })
    .min(1, 'Query cannot be empty')
    .max(4000, 'Query must be at most 4000 characters'),
});

export type SendMessageDTO = z.infer<typeof SendMessageDTOSchema>;

// Chat Message Response DTO
export interface ChatMessageResponseDTO {
  id: string;
  userId: string;
  query: string;
  response: string | null;
  tokens: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  } | null;
  status: 'pending' | 'completed' | 'failed';
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Chat History Response DTO
export interface ChatHistoryResponseDTO {
  messages: ChatMessageResponseDTO[];
  total: number;
  page: number;
  limit: number;
}
