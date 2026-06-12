import { z } from 'zod';

const clampedTextSchema = (maxLength: number) =>
  z
    .string()
    .transform((value) => value.trim().slice(0, maxLength))
    .pipe(z.string().min(1));

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
        meta_title: clampedTextSchema(70),
        meta_description: clampedTextSchema(160),
        keywords: z.array(clampedTextSchema(100)).max(20),
      })
    )
    .min(1)
    .max(20),
});
