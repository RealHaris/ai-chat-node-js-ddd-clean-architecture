import { z } from 'zod';

// Create Bundle Tier DTO
export const CreateBundleTierDTOSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  maxMessages: z
    .number({ required_error: 'maxMessages is required' })
    .int('maxMessages must be an integer')
    .refine(val => val === -1 || val >= 1, {
      message: 'maxMessages must be -1 (unlimited) or at least 1',
    }),
  priceMonthly: z
    .string({ required_error: 'priceMonthly is required' })
    .refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
      message: 'priceMonthly must be a valid non-negative number',
    }),
  priceYearly: z
    .string({ required_error: 'priceYearly is required' })
    .refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
      message: 'priceYearly must be a valid non-negative number',
    }),
  isActive: z.boolean().optional().default(true),
});

export type CreateBundleTierDTO = z.infer<typeof CreateBundleTierDTOSchema>;

// Update Bundle Tier DTO
export const UpdateBundleTierDTOSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters')
    .optional(),
  maxMessages: z
    .number()
    .int('maxMessages must be an integer')
    .refine(val => val === -1 || val >= 1, {
      message: 'maxMessages must be -1 (unlimited) or at least 1',
    })
    .optional(),
  priceMonthly: z
    .string()
    .refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
      message: 'priceMonthly must be a valid non-negative number',
    })
    .optional(),
  priceYearly: z
    .string()
    .refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
      message: 'priceYearly must be a valid non-negative number',
    })
    .optional(),
  isActive: z.boolean().optional(),
});

export type UpdateBundleTierDTO = z.infer<typeof UpdateBundleTierDTOSchema>;

// Bundle Tier Response DTO
export interface BundleTierResponseDTO {
  id: string;
  name: string;
  maxMessages: number;
  priceMonthly: string;
  priceYearly: string;
  isActive: boolean;
  isUnlimited: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}
