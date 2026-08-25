import { z } from 'zod';

const ProductSpecificationItemSchema = z.strictObject({
  label: z.string().trim().min(1).max(160),
  value: z.string().trim().min(1).max(2_000),
});

const ProductSpecificationsSchema = z
  .array(
    z.strictObject({
      category: z.string().trim().min(1).max(160),
      items: z.array(ProductSpecificationItemSchema).min(1).max(128),
    })
  )
  .max(64);

const ProductKeySpecsSchema = z
  .record(
    z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z][a-z0-9_]*$/),
    z.union([
      z.string().max(2_000),
      z
        .number()
        .finite()
        .min(-Number.MAX_SAFE_INTEGER)
        .max(Number.MAX_SAFE_INTEGER),
      z.boolean(),
      z.array(z.string().max(500)).max(32),
    ])
  )
  .superRefine((specs, context) => {
    if (Object.keys(specs).length > 128)
      context.addIssue({
        code: 'custom',
        message: 'Product key specs must contain at most 128 entries',
      });
  })
  .transform((specs) =>
    Object.fromEntries(
      Object.entries(specs).sort(([left], [right]) => left.localeCompare(right))
    )
  );

/** Bounded structured specification fields published for PDP and comparison use. */
export const StorefrontPublicProductSpecificationFieldsSchema = z.strictObject({
  specifications: ProductSpecificationsSchema.nullable().optional(),
  productKeySpecs: ProductKeySpecsSchema.nullable().optional(),
});
