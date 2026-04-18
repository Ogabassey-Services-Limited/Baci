import { z } from 'zod';

export const storefrontFeaturesQuerySchema = z
  .object({
    merchantId: z.string().uuid({ message: 'Invalid merchantId' }).optional(),
    slug: z.string().trim().min(1).max(255).optional(),
  })
  .refine(({ merchantId, slug }) => Boolean(merchantId || slug), {
    message: 'merchantId or slug is required',
  });
