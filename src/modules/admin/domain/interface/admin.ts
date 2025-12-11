import { z } from 'zod';

export const AdminAttributesSchema = z.object({
  id: z.string(),
  userId: z.string(),
});

export type IAdminAttributes = z.infer<typeof AdminAttributesSchema>;
