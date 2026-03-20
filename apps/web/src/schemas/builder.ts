import { z } from 'zod';

const builderComponentSchema = z
  .object({
    type: z.string().trim().min(1),
    props: z.record(z.string(), z.unknown()).default({}),
  })
  .passthrough();

const builderRootSchema = z
  .object({
    title: z.string().optional(),
  })
  .passthrough();

export const builderConfigSchema = z
  .object({
    content: z.array(builderComponentSchema).default([]),
    root: builderRootSchema.default({ title: 'Home' }),
    zones: z.record(z.string(), z.unknown()).default({}),
  })
  .passthrough();

export const builderExpectedLastUpdatedSchema = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .optional();

export const builderDegradedReasonSchema = z.enum([
  'config_load_failed',
  'default_generation_failed',
]);

export const builderCreateSchema = z.object({
  slug: z.string().trim().min(1).optional().default('home'),
  config: builderConfigSchema,
  name: z.string().trim().min(1).optional().default('Home'),
  seo: z.unknown().nullable().optional(),
  storeSettings: z.unknown().nullable().optional(),
  setupSettings: z.unknown().nullable().optional(),
  expectedLastUpdated: builderExpectedLastUpdatedSchema,
});

export const builderPublishSchema = z.object({
  slug: z.string().trim().min(1, 'Slug is required'),
  expectedLastUpdated: builderExpectedLastUpdatedSchema,
});

export type BuilderCreateInput = z.infer<typeof builderCreateSchema>;
export type BuilderPublishInput = z.infer<typeof builderPublishSchema>;
export type BuilderConfigInput = z.infer<typeof builderConfigSchema>;
export type BuilderDegradedReason = z.infer<typeof builderDegradedReasonSchema>;
