import { z } from 'zod';

export const storefrontAccountDocumentParamsSchema = z.object({
  id: z.uuid(),
});

export const storefrontAccountDocumentQuerySchema = z.object({
  merchantSlug: z
    .string()
    .trim()
    .min(1, 'Merchant slug is required')
    .max(100, 'Merchant slug must be 100 characters or fewer')
    .transform((value) => value.toLowerCase())
    .refine(
      (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
      'Merchant slug must contain only lowercase letters, numbers, and hyphens'
    ),
});
