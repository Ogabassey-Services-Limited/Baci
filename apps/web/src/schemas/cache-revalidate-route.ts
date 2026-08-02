import { z } from 'zod';
import { internalRevalidateProductEntrySchema } from './internal-revalidate-products-route';

export const cacheRevalidateRequestSchema = z.object({
  targets: z
    .array(
      z.enum([
        'products',
        'categories',
        'merchant',
        'blog',
        'reviews',
        'features',
        'pages',
        'all',
      ])
    )
    .min(1, 'At least one target is required'),
  products: z.array(internalRevalidateProductEntrySchema).max(1000).optional(),
  merchantId: z.string().trim().min(1).max(255).optional(),
});
