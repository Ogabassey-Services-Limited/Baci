import { z } from 'zod';

export const aiJobTypeSchema = z.enum([
  'price_list_processing',
  'storefront_layout_generation',
]);

export const storefrontLayoutJobInputSchema = z
  .object({
    pageSlug: z.string().trim().min(1).default('home'),
    businessName: z.string().trim().min(1).max(120),
    businessType: z.string().trim().min(1).max(80),
    brandColors: z.record(z.string(), z.unknown()).nullable(),
    createdPageConfigUpdatedAt: z
      .string()
      .datetime({ offset: true })
      .nullable(),
  })
  .strict();

export const createAiJobSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('price_list_processing'),
    input: z.unknown(),
  }),
  z.object({
    type: z.literal('storefront_layout_generation'),
    input: storefrontLayoutJobInputSchema,
  }),
]);

export const applyAiDraftSchema = z
  .object({
    force: z.boolean().optional().default(false),
  })
  .strict();

export type AiJobType = z.infer<typeof aiJobTypeSchema>;
export type CreateAiJobInput = z.infer<typeof createAiJobSchema>;
export type ApplyAiDraftInput = z.infer<typeof applyAiDraftSchema>;
export type StorefrontLayoutJobInput = z.infer<
  typeof storefrontLayoutJobInputSchema
>;
