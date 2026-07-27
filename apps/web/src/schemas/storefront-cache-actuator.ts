import { z } from 'zod';
import { categorySlugSchema } from '@/schemas/category-slug';

const MAX_RELATED_CATEGORY_SLUGS = 32;

const uuidSchema = z.uuid();
const sha256HexSchema = z.string().regex(/^[a-f0-9]{64}$/);

/**
 * The deliberately flat worker-to-actuator request. In particular, callers
 * cannot select hosts, URLs, cache tags, or individual purge operations.
 */
export const storefrontCacheActuatorSchema = z
  .object({
    schemaVersion: z.literal(1),
    obligationId: uuidSchema,
    generation: z.number().int().positive(),
    merchantId: uuidSchema,
    previousSlug: categorySlugSchema.nullable(),
    nextSlug: categorySlugSchema.nullable(),
    relatedSlugs: z
      .array(categorySlugSchema)
      .max(MAX_RELATED_CATEGORY_SLUGS)
      .transform((slugs) => Array.from(new Set(slugs))),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.previousSlug === null &&
      value.nextSlug === null &&
      value.relatedSlugs.length === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one category slug is required',
        path: ['relatedSlugs'],
      });
    }
  });

export const storefrontCacheActuatorReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    obligationId: uuidSchema,
    generation: z.number().int().positive(),
    requestBodySha256: sha256HexSchema,
    completedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type StorefrontCacheActuatorRequest = z.infer<
  typeof storefrontCacheActuatorSchema
>;
export type StorefrontCacheActuatorReceipt = z.infer<
  typeof storefrontCacheActuatorReceiptSchema
>;
