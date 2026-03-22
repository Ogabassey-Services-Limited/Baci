import { z } from 'zod';

export const storefrontAccountDocumentParamsSchema = z.object({
  id: z.string().uuid(),
});

export const storefrontAccountDocumentQuerySchema = z.object({
  merchantSlug: z
    .string()
    .trim()
    .min(1, 'Merchant slug is required')
    .max(100, 'Merchant slug must be 100 characters or fewer')
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Merchant slug must contain only lowercase letters, numbers, and hyphens'
    ),
});
