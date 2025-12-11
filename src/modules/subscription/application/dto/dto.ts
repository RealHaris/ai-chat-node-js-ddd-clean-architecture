import { z } from 'zod';

// Subscribe DTO
export const SubscribeDTOSchema = z.object({
  bundleTierId: z.string().uuid({ message: 'Invalid bundle tier ID' }),
  billingCycle: z.enum(['monthly', 'yearly'], {
    errorMap: () => ({
      message: 'Billing cycle must be "monthly" or "yearly"',
    }),
  }),
});

export type SubscribeDTO = z.infer<typeof SubscribeDTOSchema>;

// Toggle Auto Renewal DTO
export const ToggleAutoRenewalDTOSchema = z.object({
  subscriptionId: z.string().uuid({ message: 'Invalid subscription ID' }),
});

export type ToggleAutoRenewalDTO = z.infer<typeof ToggleAutoRenewalDTOSchema>;

// Cancel Subscription DTO
export const CancelSubscriptionDTOSchema = z.object({
  subscriptionId: z.string().uuid({ message: 'Invalid subscription ID' }),
});

export type CancelSubscriptionDTO = z.infer<typeof CancelSubscriptionDTOSchema>;

// Subscription Response DTO
export interface SubscriptionResponseDTO {
  id: string;
  userId: string;
  bundleTierId: string;
  bundleName: string;
  bundleMaxMessages: number;
  bundlePrice: string;
  billingCycle: 'monthly' | 'yearly';
  autoRenewal: boolean;
  status: boolean;
  isActive: boolean;
  isUnlimited: boolean;
  startDate: Date;
  endDate: Date;
  renewalDate: Date;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
