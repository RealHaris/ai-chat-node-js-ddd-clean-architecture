import { z } from 'zod';

import { UserAttributesSchema } from '~/modules/user/domain/interface/user';

// Create user DTO - used internally (registration handles user creation for clients)
export const CreateUserDTOSchema = UserAttributesSchema.pick({
  email: true,
  phone: true,
  password: true,
});

export type CreateUserDTO = z.infer<typeof CreateUserDTOSchema>;

// Update user DTO
export const UpdateUserDTOSchema = z.object({
  phone: z.string().max(20).nullish(),
});

export type UpdateUserDTO = z.infer<typeof UpdateUserDTOSchema>;

// Get user response DTO
export const UserResponseDTOSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  phone: z.string().nullish(),
  role: z.enum(['admin', 'user']),
  currentTier: z.string().nullish(),
  messagesUsed: z.number(),
  messagesLimit: z.number(),
  totalSpent: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type UserResponseDTO = z.infer<typeof UserResponseDTOSchema>;
