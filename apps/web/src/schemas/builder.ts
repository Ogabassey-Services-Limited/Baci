import { z } from 'zod';

const builderConfigSchema = z.object({}).passthrough();

export const builderCreateSchema = z.object({
  slug: z.string().trim().min(1).optional().default('home'),
  config: builderConfigSchema,
  name: z.string().trim().min(1).optional().default('Home'),
  seo: z.unknown().nullable().optional(),
  storeSettings: z.unknown().nullable().optional(),
  setupSettings: z.unknown().nullable().optional(),
});

export const builderPublishSchema = z.object({
  slug: z.string().trim().min(1, 'Slug is required'),
});

export type BuilderCreateInput = z.infer<typeof builderCreateSchema>;
export type BuilderPublishInput = z.infer<typeof builderPublishSchema>;
