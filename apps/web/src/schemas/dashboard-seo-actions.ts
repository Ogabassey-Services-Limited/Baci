import { z } from 'zod';

export const seoMerchantIdSchema = z.uuid();

export const generateSEOSuggestionsInputSchema = z.object({
  merchantId: z.uuid(),
  productIds: z
    .array(z.uuid())
    .min(1, 'At least one product is required')
    .max(20, 'Maximum 20 products per batch'),
});

export const saveSEOSettingsInputSchema = z.object({
  merchantId: z.uuid(),
  optimizations: z
    .array(
      z.object({
        productId: z.uuid(),
        meta_title: z.string().min(1).max(70),
        meta_description: z.string().min(1).max(160),
        keywords: z.array(z.string().min(1).max(100)).max(20),
      })
    )
    .min(1)
    .max(20),
});
