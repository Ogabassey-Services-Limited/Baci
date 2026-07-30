import { z } from 'zod';
import { merchantIdParamSchema } from '@/schemas/merchant-id-param';

const builderComponentSchema = z.looseObject({
  type: z.string().trim().min(1),
  props: z.record(z.string(), z.unknown()).default({}),
});

const builderRootSchema = z.looseObject({
  title: z.string().optional(),
});

export const builderConfigSchema = z.looseObject({
  content: z.array(builderComponentSchema).default([]),
  root: builderRootSchema.default({ title: 'Home' }),
  zones: z.record(z.string(), z.unknown()).default({}),
});

const builderExpectedLastUpdatedSchema = z.iso
  .datetime({ offset: true })
  .nullable()
  .optional();

const builderDegradedReasonSchema = z.enum([
  'config_load_failed',
  'default_generation_failed',
]);

export const builderCreateSchema = z.object({
  merchantId: merchantIdParamSchema,
  slug: z.string().trim().min(1).optional().default('home'),
  config: builderConfigSchema,
  name: z.string().trim().min(1).optional().default('Home'),
  seo: z.unknown().nullable().optional(),
  storeSettings: z.unknown().nullable().optional(),
  setupSettings: z.unknown().nullable().optional(),
  expectedLastUpdated: builderExpectedLastUpdatedSchema,
});

export const builderPublishSchema = z.object({
  merchantId: merchantIdParamSchema,
  slug: z.string().trim().min(1, 'Slug is required'),
  expectedLastUpdated: builderExpectedLastUpdatedSchema,
});

export const builderLoadQuerySchema = z.object({
  merchantId: merchantIdParamSchema,
  slug: z.string().trim().min(1).optional().default('home'),
  aiDraftJobId: z.uuid().optional(),
});

export type BuilderCreateInput = z.infer<typeof builderCreateSchema>;
export type BuilderPublishInput = z.infer<typeof builderPublishSchema>;
export type BuilderLoadQueryInput = z.infer<typeof builderLoadQuerySchema>;
export type BuilderConfigInput = z.infer<typeof builderConfigSchema>;
export type BuilderDegradedReason = z.infer<typeof builderDegradedReasonSchema>;

export function parseBuilderConfigForAiDraft(
  value: unknown
): BuilderConfigInput {
  return builderConfigSchema.parse(value);
}
