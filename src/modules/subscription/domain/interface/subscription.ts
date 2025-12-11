import { z } from 'zod';

export const SubscriptionAttributesSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  bundleTierId: z.string().uuid(),
  bundleName: z.string(),
  bundleMaxMessages: z.number().int(),
  bundlePrice: z.string(),
  billingCycle: z.enum(['monthly', 'yearly']),
  autoRenewal: z.boolean().default(true),
  status: z.boolean().default(true),
  startDate: z.date(),
  endDate: z.date(),
  renewalDate: z.date(),
  cancelledAt: z.date().nullable().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type ISubscriptionAttributes = z.infer<
  typeof SubscriptionAttributesSchema
>;

export type BillingCycle = 'monthly' | 'yearly';
