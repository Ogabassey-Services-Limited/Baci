import { z } from 'zod';

/**
 * Category management payloads (B1-lite).
 *
 * `merchantId` is OPTIONAL and never authoritative: the route derives the
 * merchant from the session and treats a supplied value only as an assertion to
 * reject on mismatch (a staff user belonging to multiple merchants must not be
 * able to mutate the wrong tenant). Mirrors `/api/cache/revalidate`.
 */

const merchantIdAssertion = z.string().trim().min(1).max(255).optional();

/** Storefront-safe slug: lowercase alphanumeric words separated by single dashes. */
export const categorySlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug must be lowercase alphanumeric words separated by single dashes'
  );

export const createMerchantCategorySchema = z.object({
  merchantId: merchantIdAssertion,
  name: z.string().trim().min(1).max(160),
  slug: categorySlugSchema,
  description: z.string().trim().max(2000).nullish(),
  imageUrl: z.string().trim().url().max(2048).nullish(),
  parentId: z.uuid().nullish(),
  displayOrder: z.number().int().min(0).max(100_000).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Update payload. Every field optional, but at least one must be present —
 * an empty PATCH would purge caches for no reason.
 */
export const updateMerchantCategorySchema = z
  .object({
    merchantId: merchantIdAssertion,
    name: z.string().trim().min(1).max(160).optional(),
    slug: categorySlugSchema.optional(),
    description: z.string().trim().max(2000).nullish(),
    imageUrl: z.string().trim().url().max(2048).nullish(),
    parentId: z.uuid().nullish(),
    displayOrder: z.number().int().min(0).max(100_000).optional(),
    // `false` is the "deactivate" operation — categories are soft-disabled so
    // the public read policy (is_active = true) hides them without breaking
    // products that still reference the category.
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      Object.keys(value).some(
        (key) =>
          key !== 'merchantId' && value[key as keyof typeof value] !== undefined
      ),
    { message: 'At least one field must be provided' }
  );

export type CreateMerchantCategoryInput = z.infer<
  typeof createMerchantCategorySchema
>;
export type UpdateMerchantCategoryInput = z.infer<
  typeof updateMerchantCategorySchema
>;
