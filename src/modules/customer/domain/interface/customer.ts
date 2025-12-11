import { z } from 'zod';

export const CustomerAttributesSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  userId: z.string(),
  notes: z.string().nullish(),
});

export type ICustomerAttributes = z.infer<typeof CustomerAttributesSchema>;
