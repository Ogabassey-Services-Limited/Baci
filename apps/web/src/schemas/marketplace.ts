import { z } from 'zod';

export const jumiaMerchantIdQuerySchema = z.object({
  merchantId: z.string().uuid('merchantId must be a valid UUID').optional(),
  integrationId: z
    .string()
    .uuid('integrationId must be a valid UUID')
    .optional(),
});

export const jumiaOrderIdParamSchema = z.object({
  id: z.string().min(1),
});

export type JumiaOrderIdParam = z.infer<typeof jumiaOrderIdParamSchema>;

export const integrationIdSchema = z
  .string()
  .uuid('integrationId must be a valid UUID');

export type IntegrationId = z.infer<typeof integrationIdSchema>;

export const deleteJumiaConnectionQuerySchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, 'Integration ID required')
    .pipe(integrationIdSchema),
});
