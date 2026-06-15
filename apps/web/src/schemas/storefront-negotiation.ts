import { z } from 'zod';

export const storefrontNegotiationSchema = z.object({
  productId: z.uuid(),
  merchantId: z.uuid(),
  offeredPrice: z.number().positive(),
  customerEmail: z.email().optional(),
  customerPhone: z.string().optional(),
  attemptNumber: z.number().min(1).max(3).default(1),
  evidenceUrl: z.url().optional(),
  evidenceNote: z.string().max(500).optional(),
});

export type StorefrontNegotiationInput = z.infer<
  typeof storefrontNegotiationSchema
>;
