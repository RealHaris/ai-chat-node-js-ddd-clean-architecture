import { z } from 'zod';

export const BundleTierAttributesSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, { message: 'Name is required' }).max(100),
  maxMessages: z.number().int(), // -1 for unlimited
  priceMonthly: z.string(),
  priceYearly: z.string(),
  isActive: z.boolean().default(true),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  deletedAt: z.date().nullable().optional(),
});

export type IBundleTierAttributes = z.infer<typeof BundleTierAttributesSchema>;

export interface IBundleTierRepository {
  findById(id: string): Promise<IBundleTierAttributes | null>;
  findByName(name: string): Promise<IBundleTierAttributes | null>;
  findAll(includeInactive?: boolean): Promise<IBundleTierAttributes[]>;
  findActive(): Promise<IBundleTierAttributes[]>;
  create(bundleTier: IBundleTierAttributes): Promise<IBundleTierAttributes>;
  update(
    id: string,
    bundleTier: Partial<IBundleTierAttributes>
  ): Promise<IBundleTierAttributes | null>;
  softDelete(id: string): Promise<boolean>;
}
