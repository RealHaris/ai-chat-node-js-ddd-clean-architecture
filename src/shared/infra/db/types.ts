import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import { bundleTiers } from './schemas/bundle_tiers';
import { chatMessages } from './schemas/chat_messages';
import { subscriptions } from './schemas/subscriptions';
import { users } from './schemas/users';

// Database row types - Users
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

// Database row types - Bundle Tiers
export type BundleTier = InferSelectModel<typeof bundleTiers>;
export type NewBundleTier = InferInsertModel<typeof bundleTiers>;

// Database row types - Subscriptions
export type Subscription = InferSelectModel<typeof subscriptions>;
export type NewSubscription = InferInsertModel<typeof subscriptions>;

// Database row types - Chat Messages
export type ChatMessage = InferSelectModel<typeof chatMessages>;
export type NewChatMessage = InferInsertModel<typeof chatMessages>;

// API response types (without database fields)
export type UserResponse = Omit<User, 'deletedAt' | 'password'>;
export type BundleTierResponse = Omit<BundleTier, 'deletedAt'>;
export type SubscriptionResponse = Subscription;
export type ChatMessageResponse = ChatMessage;

// Utility types for validation and utilities
export type ValidationResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type DatabaseRecord = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};

export type RequestContext = {
  requestId?: string;
  user?: User;
};

// Token types for chat messages
export type OpenAITokenUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: {
    cached_tokens: number;
    audio_tokens: number;
  };
  completion_tokens_details?: {
    reasoning_tokens: number;
    audio_tokens: number;
    accepted_prediction_tokens: number;
    rejected_prediction_tokens: number;
  };
};

// User roles
export type UserRole = 'user' | 'admin';

// Billing cycles
export type BillingCycle = 'monthly' | 'yearly';

// Chat message status
export type ChatMessageStatus = 'pending' | 'completed' | 'failed';
